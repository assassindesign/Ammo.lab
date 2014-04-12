/**   _     _   _     
*    | |___| |_| |__
*    | / _ \  _|    |
*    |_\___/\__|_||_|
*    @author LoTh /http://3dflashlo.wordpress.com/
*/

// AMMO for three.js

// By default, Bullet assumes units to be in meters and time in seconds.
// The simulation steps in fraction of seconds (1/60 sec or 60 hertz),
// and gravity in meters per square second (9.8 m/s^2).
// Bullet was designed for (0.05 to 10). 
 
'use strict';
var AMMO={ REVISION: 0.2 };

AMMO.TORAD = Math.PI / 180;

AMMO.STATIC_OBJECT = 1;
AMMO.KINEMATIC_OBJECT = 2;

AMMO.STATIC = 0;
AMMO.DYNAMIC = 1;

AMMO.ACTIVE = 1;
AMMO.ISLAND_SLEEPING = 2;
AMMO.WANTS_DEACTIVATION = 3;
AMMO.DISABLE_DEACTIVATION = 4;
AMMO.DISABLE_SIMULATION = 5;

AMMO.BT_LARGE_FLOAT = 1000000.0;

AMMO.WORLD_SCALE = 100;
AMMO.INV_SCALE = 0.01;

AMMO.MAX_BODY = 1024;
AMMO.MAX_CAR = 20;
AMMO.MAX_CAR_WHEEL = 4;

AMMO.V3 = function(x, y, z){
	return new Ammo.btVector3(x || 0, y || 0, z || 0);
}

AMMO.copyV3 = function (a,b) { b.setX(a[0]); b.setY(a[1]); b.setZ(a[2]); }

//--------------------------------------------------
//  RIGIDBODY
//--------------------------------------------------

AMMO.World = function(obj){
	this.mtx = new Float32Array(AMMO.MAX_BODY*8);
	this.mtxCar = new Float32Array(AMMO.MAX_CAR*(8+(8*AMMO.MAX_CAR_WHEEL)));

	this.Broadphase = obj.broadphase || "BVT";
	this.gravity = obj.G || -100;
	this.ws = obj.worldScale || 100;
	this.iteration = obj.iteration || 2;

	this.solver = null;
	this.collisionConfig = null;
	this.dispatcher = null;
	this.broadphase = null;
	this.world = null;

	this.BODYID = 0;
	this.CARID = 0;

	this.bodys = null;
	this.cars = null;

	this.terrain = null;

	this.init();

	this.last = Date.now();; 
	this.now = 0;
	this.dt = 0;
	this.tt = [0 , 0];

	this.infos = [];

	this.key = [0,0,0,0,0,0,0];
}

AMMO.World.prototype = {
    constructor: AMMO.World,
    init:function(){
		if(this.world == null){
			//this.last = Date.now();
			this.solver = new Ammo.btSequentialImpulseConstraintSolver();
			this.collisionConfig = new Ammo.btDefaultCollisionConfiguration();
			this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfig);

			switch(this.Broadphase){
				case 'SAP': this.broadphase = new Ammo.btAxisSweep3(AMMO.V3(-10*ws,-10*ws,-10*ws),AMMO.V3(10*ws,10*ws,10*ws), 4096); break;//16384;
				case 'BVT': this.broadphase = new Ammo.btDbvtBroadphase(); break;
				case 'SIMPLE': this.broadphase = new Ammo.btSimpleBroadphase(); break;
			}

			this.world = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.broadphase, this.solver, this.collisionConfig);
			this.world.setGravity(AMMO.V3(0, this.gravity, 0));

			this.bodys = [];
			this.cars = [];
		}
    },
    clear:function(){
    	var i; 
    	i = this.BODYID;
	    while (i--) {
	        this.world.removeRigidBody(this.bodys[i].body);
	        Ammo.destroy( this.bodys[i].body );
	    }
	    i = this.CARID;
	    while (i--) {
	    	this.world.removeRigidBody(this.cars[i].body);
	        this.world.removeVehicle(this.cars[i].vehicle);
	        Ammo.destroy( this.cars[i].body );
	        Ammo.destroy( this.cars[i].vehicle );
	    }
	    this.world.clearForces();
	    if(this.terrain!== null) this.terrain = null;

	    this.bodys.length = 0;
	    this.BODYID = 0;

	    this.cars.length = 0;
	    this.CARID = 0;

    	this.world.getBroadphase().resetPool(this.world.getDispatcher());
	    this.world.getConstraintSolver().reset();

		Ammo.destroy( this.world );
		Ammo.destroy( this.solver );
		Ammo.destroy( this.collisionConfig );
		Ammo.destroy( this.dispatcher );
		Ammo.destroy( this.broadphase );

		this.world = null;

    },
    addBody:function(obj){
    	var id = this.BODYID++;
		this.bodys[id] = new AMMO.Rigid(obj, this );
    },
    addCar:function(obj){
    	var id = this.CARID++;
		this.cars[id] = new AMMO.Vehicle(obj, this );
    },
    step:function(dt){
    	//dt = dt || 1;
    	var now = Date.now();
    	this.dt = now - this.last;
    	this.world.stepSimulation( this.dt, this.iteration);
    	var i;
    	i = this.BODYID;
	    while (i--) { this.bodys[i].getMatrix(i); }
	    i = this.CARID;
	    while (i--) { 
	    	if(i==this.key[6])this.cars[i].drive();
	    	this.cars[i].getMatrix(i);
	    }

	    this.last = now;
	    this.upInfo();
    },
    upInfo:function(){
    	this.infos[1] = this.BODYID;
    	this.infos[2] = this.CARID;
    	
    	if (this.last - 1000 > this.tt[0]) { this.tt[0] = this.last; this.infos[0] = this.tt[1]; this.tt[1] = 0; } this.tt[1]++;
    },
    setKey:function(k){
    	this.key = k;
    }

}

//--------------------------------------------------
//  RIGIDBODY
//--------------------------------------------------

AMMO.Rigid = function(obj, Parent){
	this.parent = Parent;
	this.body = null;
	this.forceUpdate = false;
	this.init(obj);
	this.forceState = false;
}

AMMO.Rigid.prototype = {
    constructor: AMMO.Rigid,
    init:function(obj){
    	var mass = obj.mass || 0;
    	var size = obj.size || [1,1,1];
    	var dir = obj.dir || [0,1,0]; // for infinite plane
    	var div = obj.div || [64,64];
		var pos = obj.pos || [0,0,0];
		var rot = obj.rot || [0,0,0];
		// phy = [friction, restitution];
		var phy = obj.phy || [0.5,0];
		var noSleep = obj.noSleep || false;

		var shape;
		
		switch(obj.type){
			case 'plane': shape = new Ammo.btStaticPlaneShape(AMMO.V3(dir[0], dir[1], dir[2]), 0);break;
			case 'box': case 'boxbasic': case 'dice': case 'ground': 
			    shape = new Ammo.btBoxShape(AMMO.V3(size[0]*0.5, size[1]*0.5, size[2]*0.5)); 
			break;
			case 'sphere': shape = new Ammo.btSphereShape(size[0]); break;	
			case 'cylinder': shape = new Ammo.btCylinderShape(AMMO.V3(size[0], size[1]*0.5, size[2]*0.5)); break;
			case 'cone': shape = new Ammo.btConeShape(size[0], size[1]*0.5); break;
			case 'capsule': shape = new Ammo.btCapsuleShape(size[0], size[1]*0.5); break;
			case 'mesh':
			    var mTriMesh = new Ammo.btTriangleMesh();
			    var removeDuplicateVertices = true;
			    var v0 = AMMO.V3(0,0,0);
			    var v1 = AMMO.V3(0,0,0); 
                var v2 = AMMO.V3(0,0,0);
                var vx = obj.v;
                for (var i = 0, fMax = vx.length; i < fMax; i+=9){
	                v0.setValue( vx[i+0], vx[i+1], vx[i+2] );
	                v1.setValue( vx[i+3], vx[i+4], vx[i+5] );
	                v2.setValue( vx[i+6], vx[i+7], vx[i+8] );
	                mTriMesh.addTriangle(v0,v1,v2, removeDuplicateVertices);
	            }
			    if(mass == 0){ 
			    	// btScaledBvhTriangleMeshShape -- if scaled instances
			    	shape = new Ammo.btBvhTriangleMeshShape(mTriMesh, true, true);
			    }else{ 
			    	// btGimpactTriangleMeshShape -- complex?
			    	// btConvexHullShape -- possibly better?
			    	shape = new Ammo.btConvexTriangleMeshShape(mTriMesh,true);
			    }
			break;
			case 'convex':
			    shape = new Ammo.btConvexHullShape();
			    var v = AMMO.V3(0,0,0);
			    var vx = obj.v;
			    for (var i = 0, fMax = vx.length; i < fMax; i+=3){
			    	AMMO.copyV3([vx[i+0], vx[i+1], vx[i+2]], v);
			    	shape.addPoint(v);
			    }
			break;
			case 'terrain': 
			    this.parent.terrain = new AMMO.Terrain(div, size);
			    shape = this.parent.terrain.shape;
			break;
		}

		var transform = new Ammo.btTransform();
		transform.setIdentity();
		// position
		transform.setOrigin(AMMO.V3(pos[0], pos[1], pos[2]));
		// rotation
		var q = new Ammo.btQuaternion();
		q.setEulerZYX(rot[2]*AMMO.TORAD,rot[1]*AMMO.TORAD,rot[0]*AMMO.TORAD);
		transform.setRotation(q);

		
		// static
		if(mass == 0){
		    this.forceUpdate = true;
		    //this.flags = AMMO.STATIC_OBJECT;
		    this.type = AMMO.STATIC;
		} else {
			//this.flags = AMMO.KINEMATIC_OBJECT;
			this.type = AMMO.DYNAMIC;
		}

		var localInertia = AMMO.V3(0, 0, 0);
		shape.calculateLocalInertia(mass, localInertia);
		this.motionState = new Ammo.btDefaultMotionState(transform);
		//if(noSleep)myMotionState.setActivationState(4);//this.body.setFlags(4);

		var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState, shape, localInertia);
		rbInfo.set_m_friction(phy[0]);
		rbInfo.set_m_restitution(phy[1]);

		this.body = new Ammo.btRigidBody(rbInfo);
		Ammo.destroy(rbInfo);

		//this.body.setLinearVelocity(AMMO.V3(0,0,0));
		//this.body.setAngularVelocity(AMMO.V3(0,0,0));

		//this.body.setCollisionFlags(this.flags);
		//this.body.setCollisionFlags
		//this.body.setTypes(this.type);
        
		//this.body.setContactProcessingThreshold(AMMO.BT_LARGE_FLOAT);
		//this.body.setFriction(phy[0]);
		//this.body.setRestitution(phy[1]);
		

		if(noSleep) this.body.setActivationState(AMMO.DISABLE_DEACTIVATION);

		this.parent.world.addRigidBody(this.body);

		this.body.activate();
    },
    set:function(obj){
    	var v = AMMO.V3(0,0,0);
    	this.body.setLinearVelocity(v);
    	this.body.setAngularVelocity(v);
    	this.body.clearForces();
    	if(obj.pos){ this.body.getCenterOfMassTransform().setOrigin(AMMO.V3(obj.pos[0], obj.pos[1], obj.pos[2], true));}
    	if(obj.rot){
    		var q = new Ammo.btQuaternion();
    		q.setEulerZYX(obj.rot[2]*AMMO.TORAD,obj.rot[1]*AMMO.TORAD,obj.rot[0]*AMMO.TORAD);
    		this.body.getCenterOfMassTransform().setRotation(q);
    	}
    },
    getMatrix:function(id){
    	var m = this.parent.mtx;
    	var n = id*8;

    	if(this.forceUpdate){
    		m[n+0] = 1; 
    		this.forceUpdate=false;
    	}
		else{
			m[n+0] = this.body.getActivationState();
		}
		if(m[n+0]==2) return;

	    var t = this.body.getWorldTransform();
	    var r = t.getRotation();
	    var p = t.getOrigin();

	    m[n+1] = r.x();
	    m[n+2] = r.y();
	    m[n+3] = r.z();
	    m[n+4] = r.w();

	    m[n+5] = p.x();
	    m[n+6] = p.y();
	    m[n+7] = p.z();
    }
}

//--------------------------------------------------
//  TERRAIN
//--------------------------------------------------

AMMO.Terrain = function(div, size){
	this.div = div;
	this.size = size;
	this.fMax = div[0]*div[1];
	this.maxHeight = 100;
	this.ptr = Ammo.allocate(this.fMax*4, "float", Ammo.ALLOC_NORMAL);
    this.shape = new Ammo.btHeightfieldTerrainShape(this.div[0], this.div[1], this.ptr, 1, -this.maxHeight, this.maxHeight, 1, 0, false);
	this.shape.setUseDiamondSubdivision(true);
	var localScaling = AMMO.V3(this.size[0]/this.div[0],1,this.size[2]/this.div[1]);
	this.shape.setLocalScaling(localScaling);
}

AMMO.Terrain.prototype = {
	constructor: AMMO.Terrain,
    update:function(Hdata){
    	var i = this.fMax;
    	while(i--){
	    	Ammo.setValue(this.ptr+(i<<2), Hdata[i], 'float');
	    }
    }
}

//--------------------------------------------------
//  VEHICLE
//--------------------------------------------------

AMMO.Vehicle = function(obj, Parent){
	this.parent = Parent;
	this.type = obj.type || 'basic';

	this.size = obj.size || [1,1,1];
	this.pos = obj.pos || [0,0,0];
	this.rot = obj.rot || [0,0,0];
	this.phy = obj.phy || [0.5,0];
	this.massCenter = obj.massCenter || [0,0.05,0];

	this.wRadius = obj.wRadius;
	this.wDeepth = obj.wDeepth;
	this.nWheels = obj.nWheels || 4;
	this.wPos = obj.wPos || [20,5,10];

	/*this.rightIndex = 0; 
    this.upIndex = 1; 
    this.forwardIndex = 2;*/

	this.settings = obj.setting || {
		engine:600, stiffness: 40, relaxation: 0.85, compression: 0.82, travel: 500, force: 6000, frictionSlip: 20.5, reslength: 0.1, roll: 0.1	
	};


	this.maxEngineForce = obj.maxEngineForce || 2000.0;
    this.maxBreakingForce = obj.maxBreakingForce || 125.0;
    this.steeringClamp = obj.steeringClamp || 0.51;

	this.engine = 0.0;
    this.breaking = 0.0;
    this.steering = 0.0;

    this.vehicleRayCaster = null;
    this.tuning = null;
    this.vehicle = null;

    this.wheelDirectionCS0 = AMMO.V3(0, -1, 0);
    this.wheelAxleCS = AMMO.V3(-1, 0, 0);

    this.shape = new Ammo.btBoxShape(AMMO.V3(this.size[0]*0.5, this.size[1]*0.5, this.size[2]*0.5, true)); 
    this.compound = new Ammo.btCompoundShape();

    // move center of mass
    var localTrans = new Ammo.btTransform();
    localTrans.setIdentity();
    localTrans.setOrigin(AMMO.V3(this.massCenter[0],this.massCenter[1],this.massCenter[2]));
    this.compound.addChildShape(localTrans,this.shape);

    this.transform = new Ammo.btTransform();
    this.transform.setIdentity();
    // position
	this.transform.setOrigin(AMMO.V3(this.pos[0], this.pos[1], this.pos[2], true));
	// rotation
	var q = new Ammo.btQuaternion();
	q.setEulerZYX(this.rot[2]*AMMO.TORAD,this.rot[1]*AMMO.TORAD,this.rot[0]*AMMO.TORAD);
	this.transform.setRotation(q);

	this.mass = obj.mass || 400;

	this.localInertia = AMMO.V3(0, 0, 0);
	//this.shape.calculateLocalInertia(this.mass, this.localInertia);
	this.compound.calculateLocalInertia(this.mass, this.localInertia);
	this.motionState = new Ammo.btDefaultMotionState(this.transform);
	//this.rbInfo = new Ammo.btRigidBodyConstructionInfo(this.mass, this.motionState, this.shape, this.localInertia);
	this.rbInfo = new Ammo.btRigidBodyConstructionInfo(this.mass, this.motionState, this.compound, this.localInertia);
	
	this.rbInfo.set_m_friction(this.phy[0]);
	this.rbInfo.set_m_restitution(this.phy[1]);

	//console.log(this.rbInfo.get_m_linearDamping())//0
	//console.log(this.rbInfo.get_m_angularDamping())//0

	this.body = new Ammo.btRigidBody(this.rbInfo);
	this.body.setLinearVelocity([0, 0, 0]);
    this.body.setAngularVelocity([0, 0, 0]);
    this.body.setActivationState(AMMO.DISABLE_DEACTIVATION);
	//this.body.setFriction(this.phy[0]);
	//this.body.setRestitution(this.phy[1]);

	
	//world.addRigidBody(this.body);
	//this.body.activate();

    

    //this.chassis = world.localCreateRigidBody(50,tr,compound);
	//this.chassis.setActivationState(AMMO.DISABLE_DEACTIVATION);

	this.wheelShape = new Ammo.btCylinderShapeX(AMMO.V3( this.wDeepth , this.wRadius, this.wRadius));



    // create vehicle
    this.init();
}

AMMO.Vehicle.prototype = {
	constructor: AMMO.Vehicle,
	init:function(){

	    this.vehicleRayCaster = new Ammo.btDefaultVehicleRaycaster(this.parent.world);
	    this.tuning = new Ammo.btVehicleTuning();

		// 10 = Offroad buggy, 50 = Sports car, 200 = F1 Car
		this.tuning.set_m_suspensionStiffness(this.settings.stiffness); //100;
		// 0.1 to 0.3 are good values
		this.tuning.set_m_suspensionDamping(this.settings.relaxation);//0.87
		this.tuning.set_m_suspensionCompression(this.settings.compression);//0.82
		this.tuning.set_m_maxSuspensionTravelCm(this.settings.travel);//500
		this.tuning.set_m_maxSuspensionForce(this.settings.force);//6000
		this.tuning.set_m_frictionSlip( this.settings.frictionSlip);//10.5

		this.maxEngineForce = this.settings.engine;
		this.maxSteering = 0.3;


	    this.vehicle = new Ammo.btRaycastVehicle(this.tuning, this.body, this.vehicleRayCaster);
    	// choose coordinate system
    	//this.vehicle.setCoordinateSystem(this.rightIndex,this.upIndex,this.forwardIndex);
    	this.vehicle.setCoordinateSystem(0,1,2);

        var isFrontWheel = true;

        this.vehicle.addWheel( AMMO.V3(this.wPos[0], this.wPos[1], this.wPos[2]), this.wheelDirectionCS0, this.wheelAxleCS, this.settings.reslength, this.wRadius, this.tuning, isFrontWheel);
        this.vehicle.addWheel( AMMO.V3(-this.wPos[0], this.wPos[1], this.wPos[2]), this.wheelDirectionCS0, this.wheelAxleCS, this.settings.reslength, this.wRadius, this.tuning, isFrontWheel);
        this.vehicle.addWheel( AMMO.V3(-this.wPos[0], this.wPos[1], -this.wPos[2]), this.wheelDirectionCS0, this.wheelAxleCS, this.settings.reslength, this.wRadius, this.tuning, false);
        this.vehicle.addWheel( AMMO.V3(this.wPos[0], this.wPos[1], -this.wPos[2]), this.wheelDirectionCS0, this.wheelAxleCS, this.settings.reslength, this.wRadius, this.tuning, false);

        for (var i=0; i<this.vehicle.getNumWheels(); i++){
		    var wheel = this.vehicle.getWheelInfo(i);
		    wheel.set_m_rollInfluence( this.settings.roll);//0.1
		    //wheel.set_m_suspensionStiffness( this.settings.suspensionStiffness);
		    //wheel.set_m_suspensionRestLength1( this.settings.suspensionRestLength );//0.1
		    //wheel.set_m_wheelsDampingRelaxation( this.settings.wheelsDampingRelaxation);//0.85
		    //wheel.set_m_wheelsDampingCompression( this.settings.wheelsDampingCompression);//0.82
		    //wheel.set_m_frictionSlip( this.settings.frictionSlip);//10.5
		}

		this.parent.world.addVehicle(this.vehicle);
        //this.parent.world.addVehicle(this.vehicle, this.wheelShape);
        this.parent.world.addRigidBody(this.body);
	    this.body.activate();
    },
    getMatrix:function(id){
    	var m = this.parent.mtxCar;
    	var n = id*40;

		m[n+0] = this.vehicle.getCurrentSpeedKmHour();//this.body.getActivationState();

		var t = this.body.getCenterOfMassTransform();
		//var t = this.vehicle.getChassisWorldTransform(); 
		//var t = this.body.getWorldTransform(); 

	    
	    var r = t.getRotation();
	    var p = t.getOrigin();

	    m[n+1] = r.x();
	    m[n+2] = r.y();
	    m[n+3] = r.z();
	    m[n+4] = r.w();

	    if(this.type=='basic'){
	    	m[n+5] = p.x()+this.massCenter[0];
	        m[n+6] = p.y()+this.massCenter[1];
	        m[n+7] = p.z()+this.massCenter[2];
	    }else{
	    	m[n+5] = p.x();
	        m[n+6] = p.y();
	        m[n+7] = p.z();
	    }

	    

	    var i = this.nWheels;
	    var w;
	    while(i--){
	    	t = this.vehicle.getWheelInfo( i ).get_m_worldTransform();
	    	r = t.getRotation();
	        p = t.getOrigin();
	        w = 8*(i+1);
	        m[n+w+0] = i;
	        m[n+w+1] = r.x();
		    m[n+w+2] = r.y();
		    m[n+w+3] = r.z();
		    m[n+w+4] = r.w();

		    m[n+w+5] = p.x();
		    m[n+w+6] = p.y();
		    m[n+w+7] = p.z();
	    }
    },
    drive:function(){
    	var key = this.parent.key;
    	var st = 0, f=0, b=0;
    	if(key[2]==1)st=this.maxSteering;
    	if(key[3]==1)st=-this.maxSteering;
    	if(key[2]==0 && key[3]==0) st = 0;

    	if(key[0]==1)f=this.maxEngineForce;
    	if(key[1]==1)f=-0.5*this.maxEngineForce;
    	if(key[0]==0 && key[1]==0) f=0;

    	var i = this.nWheels;
    	while(i--){
    		this.vehicle.applyEngineForce( f, i );
    		this.vehicle.setBrake( b, i );
    		if(i==0 || i==1)this.vehicle.setSteeringValue( st, i );
    	}

    }
}