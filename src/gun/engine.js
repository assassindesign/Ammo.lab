/*global importScripts Ammo*/
import { math, mathExtend } from './math.js';
import { RigidBody } from './RigidBody.js';
import { Constraint } from './Constraint.js';
import { SoftBody } from './SoftBody.js';
import { Terrain } from './Terrain.js';
import { Vehicle } from './Vehicle.js';
import { Character } from './Character.js';
import { Collision } from './Collision.js';
import { RayCaster } from './RayCaster.js';
import { root, map } from './root.js';

/**   _   _____ _   _
*    | | |_   _| |_| |
*    | |_ _| | |  _  |
*    |___|_|_| |_| |_|
*    @author lo.th / https://github.com/lo-th
*    source https://github.com/lo-th/Ammo.lab
*
*    AMMO worker ultimate
*
*    By default, Bullet assumes units to be in meters and time in seconds.
*    Moving objects are assumed to be in the range of 0.05 units, about the size of a pebble,
*    to 10, the size of a truck.
*    The simulation steps in fraction of seconds (1/60 sec or 60 hertz),
*    and gravity in meters per square second (9.8 m/s^2).
*/


self.onmessage = function ( e ) {

	var data = e.data;

	// ------- buffer data
	if ( data.Ar ) engine.setAr( data.Ar );
	if ( data.flow ) root.flow = data.flow;

	// ------- engine function
	engine[ data.m ]( data.o );

};

export var engine = ( function () {

	'use strict';

	//var world = null;
	var Ar, ArPos, ArMax;
	var timestep = 1 / 60;
	var damped = 3.0 * timestep; // adjust this multiple as necessary, but for stability don't go below 3.0
	var fixed = false;
	var substep = 2;
	var delta = 0;

	var isBuffer = false;
	var isSoft = false;
	//var gravity = null;

	var jointDebug = false;

	var solver, solverSoft, collisionConfig, dispatcher, broadphase;

	var tmpRemove = [];
	var tmpAdd = [];

	var carName = "";
	var heroName = "";

	var zero = null;

	var numBreak = 0;

	var ray = null;

	var tmpT, tmpP;



	var rigidBody, softBody, constraint, terrains, vehicles, character, collision, raycaster;

	engine = {

		test: function () {},

		setAr: function ( r ) {

			Ar = r;

		},

		getAr: function () {

			return Ar;

		},

		setDrive: function ( name ) {

			carName = name;

		},

		setMove: function ( name ) {

			heroName = name;

		},

		setAngle: function ( o ) {

			root.angle = o.angle;

		},

		step: function ( o ) {


			//if ( fixed ) root.world.stepSimulation( o.delta, substep, timestep );
			//else root.world.stepSimulation( o.delta, substep );

			//root.key = o.key;


			

			//tmpRemove = tmpRemove.concat( o.remove );
			this.stepRemove();

			vehicles.control( carName );
			character.control( heroName );


			this.stepMatrix();
			this.stepOptions();
			this.stepForces();
			
			
			terrains.step();

			// breakable object
			if ( numBreak !== 0 ) this.stepBreak();

			delta = o.delta;

			if ( fixed ) root.world.stepSimulation( timestep, substep );//root.world.stepSimulation( delta, substep, timestep );
			else root.world.stepSimulation( delta, substep, timestep );

			rigidBody.step( Ar, ArPos[ 0 ] );
			collision.step( Ar, ArPos[ 1 ] );
			character.step( Ar, ArPos[ 2 ] );
			vehicles.step( Ar, ArPos[ 3 ] );
			softBody.step( Ar, ArPos[ 4 ] );
			if( jointDebug ) constraint.step( Ar, ArPos[ 5 ] );

			raycaster.step();

			if ( isBuffer ) self.postMessage( { m: 'step', flow: root.flow, Ar: Ar }, [ Ar.buffer ] );
			else self.postMessage( { m: 'step', flow: root.flow, Ar: Ar } );

		},

		clearFlow: function () {

			//root.flow = { matrix:{}, force:{}, option:{}, ray:[], terrain:[], vehicle:[] };
			root.flow = { ray:[], terrain:[], vehicle:[] };

		},

		reset: function ( o ) {

			numBreak = 0;

			carName = "";
			heroName = "";

			this.clearFlow();
			
			tmpRemove = [];
			tmpAdd = [];

			root.matrix = [];
			root.option = [];
			root.force = [];

			rigidBody.clear();
			constraint.clear();
			softBody.clear();
			terrains.clear();
			vehicles.clear();
			character.clear();
			collision.clear();
			raycaster.clear();


			// clear map map
			map.clear();

			// clear math manager
			math.destroy();

			if ( o.full ) {

				this.clearWorld();
				this.createWorld();

			}

			this.setGravity();

			// create self tranfere array if no buffer
			if ( ! isBuffer ) Ar = new Float32Array( ArMax );

			self.postMessage( { m: 'start' } );

		},

		addMulty: function ( o ) {

			for ( var i = 0, lng = o.length; i < lng; i ++ ) this.add( o[ i ] );
			o = [];

		},

		post: function ( m, o ) {

			self.postMessage( { m:m, o:o } );

		},


		init: function ( o ) {

			isBuffer = o.isBuffer || false;

			ArPos = o.ArPos;
			ArMax = o.ArMax;

			// create tranfere array if buffer
			if ( ! isBuffer ) Ar = new Float32Array( ArMax );

			//console.log(Module)
			//var Module = { TOTAL_MEMORY: 64*1024*1024 };//default // 67108864
			//self.Module = { TOTAL_MEMORY: 16*1024*1024 };//default // 67108864

			importScripts( o.blob );



			Ammo().then( function ( Ammo ) {


				mathExtend();

				engine.createWorld( o.option );
				engine.set( o.option );

				rigidBody = new RigidBody();
				constraint = new Constraint();
				softBody = new SoftBody();
				terrains = new Terrain();
				vehicles = new Vehicle();
				character = new Character();
				collision = new Collision();
				raycaster = new RayCaster();

				ray = new Ammo.ClosestRayResultCallback();

				tmpT = math.transform();
				tmpP = math.vector3();

				vehicles.addExtra = rigidBody.add;

				self.postMessage( { m: 'initEngine' } );

			} );

		},

		//-----------------------------
		//
		//   REMOVE
		//
		//-----------------------------

		remove: function ( name ) {

			if ( ! map.has( name ) ) return;
			var b = map.get( name );

			switch( b.type ){

				case 'solid': case 'body' : rigidBody.remove( name ); break;
				case 'soft': softBody.remove( name ); break;
				case 'terrain': terrains.remove( name ); break;
				case 'joint': constraint.remove( name ); break;
				case 'collision': collision.remove( name ); break;
				case 'ray': raycaster.remove( name ); break;

			}

		},

		setRemove: function ( o ) {

			tmpRemove = tmpRemove.concat( o );

		},

		stepRemove: function () {

			while ( tmpRemove.length > 0 ) this.remove( tmpRemove.pop() );

		},


		//-----------------------------
		//
		//   ADD
		//
		//-----------------------------

		add: function ( o ) {

			o.type = o.type === undefined ? 'box' : o.type;

			if ( o.breakable !== undefined ) {

				if ( o.breakable ) numBreak ++;

			}

			var type = o.type;
			var prev = o.type.substring( 0, 4 );

			if ( prev === 'join' ) constraint.add( o );
			else if ( prev === 'soft' || type === 'ellipsoid' ) softBody.add( o );
			else if ( type === 'terrain' ) terrains.add( o );
			else if ( type === 'character' ) character.add( o );
			else if ( type === 'collision' ) collision.add( o );
			else if ( type === 'ray' ) raycaster.add( o );
			else if ( type === 'car' ) vehicles.add( o );
			else rigidBody.add( o );

		},

		addAnchor: function ( o ) {

			softBody.addAnchor( o );

			//if ( ! map.has( o.soft ) || ! map.has( o.body ) ) return;
			//var collision = o.collision || false;
			//p1.fromArray(o.pos);
			//map.get( o.soft ).appendAnchor( o.node, map.get( o.body ), collision ? false : true, o.influence || 1 );
			//p1.free();

		},

		//-----------------------------
		// CONFIG
		//-----------------------------

		/*setTerrain: function ( o ) {

			terrains.setData( o );

		},*/

		setVehicle: function ( o ) {

			vehicles.setData( o );

		},

		//-----------------------------
		//
		//   WORLD
		//
		//-----------------------------

		createWorld: function ( o ) {

			if ( root.world !== null ) {

				console.error( 'World already existe !!' ); return;

			}

			o = o || {};

			zero = new Ammo.btVector3();
			zero.set( 0, 0, 0 );

			isSoft = o.soft === undefined ? true : o.soft;
			solver = new Ammo.btSequentialImpulseConstraintSolver();
			solverSoft = isSoft ? new Ammo.btDefaultSoftBodySolver() : null;
			collisionConfig = isSoft ? new Ammo.btSoftBodyRigidBodyCollisionConfiguration() : new Ammo.btDefaultCollisionConfiguration();
			dispatcher = new Ammo.btCollisionDispatcher( collisionConfig );

			switch ( o.broadphase === undefined ? 2 : o.broadphase ) {

				//case 0: broadphase = new Ammo.btSimpleBroadphase(); break;
				case 1: var s = 1000; broadphase = new Ammo.btAxisSweep3( new Ammo.btVector3( - s, - s, - s ), new Ammo.btVector3( s, s, s ), 4096 ); break;//16384;
				case 2: broadphase = new Ammo.btDbvtBroadphase(); break;

			}

			root.world = isSoft ? new Ammo.btSoftRigidDynamicsWorld( dispatcher, broadphase, solver, collisionConfig, solverSoft ) : new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collisionConfig );

			root.post = this.post;
 
			// This is required to use btGhostObjects ??
			//root.world.getPairCache().setInternalGhostPairCallback( new Ammo.btGhostPairCallback() );
			/*
			root.world.getSolverInfo().set_m_splitImpulsePenetrationThreshold(0);
			root.world.getSolverInfo().set_m_splitImpulse( true );
			*/

		},

		clearWorld: function () {

			Ammo.destroy( root.world );
			Ammo.destroy( solver );
			if ( solverSoft !== null ) Ammo.destroy( solverSoft );
			Ammo.destroy( collisionConfig );
			Ammo.destroy( dispatcher );
			Ammo.destroy( broadphase );

			root.world = null;

		},

		setWorldscale: function ( n ) {

			root.scale = n;
			root.invScale = 1 / n;

		},

		setGravity: function ( o ) {

			o = o || {};

			root.gravity = new Ammo.btVector3();
			root.gravity.fromArray( o.gravity !== undefined ? o.gravity : [ 0, - 9.81, 0 ] );
			root.world.setGravity( root.gravity );

			if ( isSoft ) {

				var worldInfo = root.world.getWorldInfo();
				worldInfo.set_m_gravity( root.gravity );

			}

		},

		set: function ( o ) {

			o = o || {};

			this.setWorldscale( o.worldscale !== undefined ? o.worldscale : 1 );

			timestep = o.fps !== undefined ? 1 / o.fps : 1 / 60;
			substep = o.substep !== undefined ? o.substep : 2;
			fixed = o.fixed !== undefined ? o.fixed : false;

			jointDebug = o.jointDebug !== undefined ? o.jointDebug : false;

			damped = 3.0 * timestep;

			// penetration
			if ( o.penetration !== undefined ) {

				var worldDispatch = root.world.getDispatchInfo();
				worldDispatch.set_m_allowedCcdPenetration( o.penetration );// default 0.0399}

			}

			// gravity
			this.setGravity( o );

		},

		//-----------------------------
		//
		//   FORCES
		//
		//-----------------------------

		setForces: function ( o ) { 

			root.force = root.force.concat( o ); 

		},

		directForces: function ( o ) {

			this.setForces( o );
			this.stepForces();

		},

		stepForces: function () {

			var i = root.force.length;
			while( i-- ) this.applyForces( root.force[i] );
			root.force = [];

		},

		applyForces: function ( o ) {

			var name = o.name;

			if ( ! map.has( name ) ) return;
			var b = map.get( name );

			//var type = r[ 1 ] || 'force';
			var p1 = math.vector3();
			var p2 = math.vector3();
			var q = math.quaternion();

			if ( o.direction !== undefined ) p1.fromArray( math.vectomult( o.direction, root.invScale ) );
			if ( o.distance !== undefined ) p2.fromArray( math.vectomult( o.distance, root.invScale ) );
			else p2.zero();

			switch ( o.type ) {

				case 'force' : case 0 : b.applyForce( p1, p2 ); break;// force , rel_pos
				case 'torque' : case 1 : b.applyTorque( p1 ); break;
				case 'localTorque' : case 2 : b.applyLocalTorque( p1 ); break;
				case 'forceCentral' :case 3 : b.applyCentralForce( p1 ); break;
				case 'forceLocal' : case 4 : b.applyCentralLocalForce( p1 ); break;
				case 'impulse' : case 5 : b.applyImpulse( p1, p2 ); break;// impulse , rel_pos
				case 'impulseCentral' : case 6 : b.applyCentralImpulse( p1 ); break;

					// joint

				case 'motor' : case 7 : b.enableAngularMotor( o.enable || true, o.targetVelocity, o.maxMotor ); break; // bool, targetVelocity float, maxMotorImpulse float
               // case 'motorTarget' : case 8 : b.setMotorTarget(  q.fromArray( o.target ), o.scale || 1 );
                case 'motorTarget' : case 8 : b.setMotorTarget(   o.target, o.axis || -1 );
                case 'setLimit' : case 9 : b.setLimit( o.limit[ 0 ] * math.torad, o.limit[ 1 ] * math.torad, o.limit[ 2 ] || 0.9, o.limit[ 3 ] || 0.3, o.limit[ 4 ] || 1.0 );
			}

			p1.free();
			p2.free();
			q.free();

		},

		//-----------------------------
		//
		//   MATRIX
		//
		//-----------------------------

		setMatrix: function ( o ) { 

			root.matrix = root.matrix.concat( o ); 

		},

		directMatrix: function ( o ) {

			this.setMatrix( o );
			this.stepMatrix();

		},

		stepMatrix: function () {

			var i = root.matrix.length;
			while( i-- ) this.applyMatrix( root.matrix[i] );
			root.matrix = [];

		},

		applyMatrix: function ( o ) {

			var name = o.name;

			if ( ! map.has( name ) ) return;
			var b = map.get( name );

			var t = tmpT; //math.transform();
			var p1 = tmpP; //math.vector3();

			//if ( b.isKinematic ) t = b.getMotionState().getWorldTransform();
			//else  t = b.getWorldTransform();
			//b.getWorldTransform ( t );

			if ( o.keepX || o.keepY || o.keepZ || o.keepRot ) { // keep original position

				b.getMotionState().getWorldTransform( t );
				var r = [];
				t.toArray( r );

				if ( o.keepX !== undefined ) o.pos[ 0 ] = r[ 0 ] - o.pos[ 0 ];
				if ( o.keepY !== undefined ) o.pos[ 1 ] = r[ 1 ] - o.pos[ 1 ];
				if ( o.keepZ !== undefined ) o.pos[ 2 ] = r[ 2 ] - o.pos[ 2 ];
				if ( o.keepRot !== undefined ) o.quat = [ r[ 3 ], r[ 4 ], r[ 5 ], r[ 6 ] ];

			}

			//t.identity();

			

			// position and rotation
			if ( o.pos !== undefined ) {

				//o.pos = math.vectomult( o.pos, root.invScale );
				if ( o.rot !== undefined ) o.quat = math.eulerToQuadArray( o.rot, true );// is euler degree
				if ( o.quat !== undefined ) o.pos = o.pos.concat( o.quat );
				
				t.fromArray( o.pos, 0, root.invScale );

				if ( b.isKinematic ) b.getMotionState().setWorldTransform( t );
			    else b.setWorldTransform( t );

			}

			//https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=11079

			if( o.clamped !== undefined ){

				var clamped = ( delta > damped ) ? 1.0 : delta / damped; // clamp to 1.0 to enforce stability
				p1.fromArray( o.pos, 0, root.invScale ).sub( b.getWorldTransform().getOrigin() ).multiplyScalar( clamped );
				b.setLinearVelocity( p1 );

			}

			if ( o.velocity && !b.isGhost ) {

				if( o.velocity[0] ) b.setLinearVelocity( p1.fromArray( o.velocity[0], 0, root.invScale ) );
				if( o.velocity[1] ) b.setAngularVelocity( p1.fromArray( o.velocity[1] ) );
				
			}

			if ( o.noVelocity && !b.isGhost ) {

				b.setLinearVelocity( zero );
				b.setAngularVelocity( zero );

			}

			if ( o.noGravity ) {

				b.setGravity( zero );

			}

			if ( o.activate ) {

				b.activate();
				
			}

			if ( b.type === 'body' && !b.isKinematic ) b.activate();
			if ( b.type === 'solid' ) self.postMessage( { m: 'moveSolid', o: { name: name, pos: o.pos, quat: o.quat } } );

			//t.free();
			//p1.free();

		},

		//-----------------------------
		//
		//   OPTION
		//
		//-----------------------------

		// ___________________________STATE
		//  1  : ACTIVE
		//  2  : ISLAND_SLEEPING
		//  3  : WANTS_DEACTIVATION
		//  4  : DISABLE_DEACTIVATION
		//  5  : DISABLE_SIMULATION

		// ___________________________FLAG
		//  1  : STATIC_OBJECT
		//  2  : KINEMATIC_OBJECT
		//  4  : NO_CONTACT_RESPONSE
		//  8  : CUSTOM_MATERIAL_CALLBACK
		//  16 : CHARACTER_OBJECT
		//  32 : DISABLE_VISUALIZE_OBJECT
		//  64 : DISABLE_SPU_COLLISION_PROCESSING

		// ___________________________GROUP
		//  -1   : ALL
		//  1    : DEFAULT
		//  2    : STATIC
		//  4    : KINEMATIC
		//  8    : DEBRIS
		//  16   : SENSORTRIGGER
		//  32   : NOCOLLISION
		//  64   : GROUP0
		//  128  : GROUP1
		//  256  : GROUP2
		//  512  : GROUP3
		//  1024 : GROUP4
		//  2048 : GROUP5
		//  4096 : GROUP6
		//  8192 : GROUP7

		setOptions: function ( o ) { 

			root.option = root.option.concat( o ); 

		},

		directOptions: function ( o ) {

			this.setOptions( o );
			this.stepOptions();

		},

		stepOptions: function () {

			var i = root.option.length;
			while( i-- ) this.applyOption( root.option[i] );
			root.option = [];

		},

		applyOption: function ( o ) {

			var name = o.name;

			if ( ! map.has( name ) ) return;
			var b = map.get( name );

			switch( b.type ){
				case 'solid': case 'body' :
				    rigidBody.applyOption( b, o );
				break;
			}

		},

		//-----------------------------
		//
		//   BREAKABLE
		//
		//-----------------------------

		stepBreak: function () {

			var manifold, point, contact, maxImpulse, impulse;
			var pos, normal, rb0, rb1, body0, body1;

			for ( var i = 0, il = dispatcher.getNumManifolds(); i < il; i ++ ) {

				manifold = dispatcher.getManifoldByIndexInternal( i );

				body0 = Ammo.castObject( manifold.getBody0(), Ammo.btRigidBody );
				body1 = Ammo.castObject( manifold.getBody1(), Ammo.btRigidBody );

				rb0 = body0.name;
				rb1 = body1.name;

				if ( ! body0.breakable && ! body1.breakable ) continue;

				contact = false;
				maxImpulse = 0;
				for ( var j = 0, jl = manifold.getNumContacts(); j < jl; j ++ ) {

					point = manifold.getContactPoint( j );
					if ( point.getDistance() < 0 ) {

						contact = true;
						impulse = point.getAppliedImpulse();

						if ( impulse > maxImpulse ) {

							maxImpulse = impulse;
							pos = point.get_m_positionWorldOnB().toArray();
							normal = point.get_m_normalWorldOnB().toArray();

						}
						break;

					}

				}

				// If no point has contact, abort
				if ( ! contact ) continue;

				// Subdivision

				if ( body0.breakable && maxImpulse > body0.breakOption[ 0 ] ) {

					self.postMessage( { m: 'makeBreak', o: { name: rb0, pos: math.vectomult( pos, root.scale ), normal: normal, breakOption: body0.breakOption } } );
					//this.remove( rb0 );

				}

				if ( body1.breakable && maxImpulse > body1.breakOption[ 0 ] ) {

					self.postMessage( { m: 'makeBreak', o: { name: rb1, pos: math.vectomult( pos, root.scale ), normal: normal, breakOption: body1.breakOption } } );
					//this.remove( rb1 );

				}

			}

		},


	};

	return engine;

} )();
