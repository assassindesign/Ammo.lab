// ROOT reference of engine worker

export var root = {

	Ar: null,
	ArPos: null,

	matrix:[],
	force:[],
	option:[],

	flow:{
		//matrix:{},
		//force:{},
		//option:{},
		ray:[],
		terrain:[],
		vehicle:[],
		key:[ 0, 0, 0, 0, 0, 0, 0, 0 ],
	},

	world: null,
	gravity: null,
	scale: 1,
	invscale: 1,
	angle: 0,

	post:null,

};

// ROW map

export var map = new Map();
