window.VB = window.VB || {};

VB.config = {
  cityExtent: 267,
  roadPitch: 74,
  roadWidth: 16,
  blockSize: 58,
  walkSpeed: 3.2,
  runSpeed: 7.5,
  carTopSpeed: 38,
  carReverseSpeed: 10,
  trafficMinSpeed: 9,
  trafficMaxSpeed: 13,
  policeTopSpeed: 40,
  playerHealth: 100,
  gunDamage: 34,
  rivalHealth: 68,
  policeBulletDamage: 5,
  bustSeconds: 2.5,
  sightLossSeconds: 12,
  debtTotal: 25000,
  colors: {
    skyHorizon: 0xff9a3c,
    skyZenith: 0x2e4a7a,
    fog: 0xe8804f,
    sun: 0xffb36b,
    hemiSky: 0xffd9a0,
    hemiGround: 0x35506b,
    road: 0x2c2f36,
    water: 0x14586b,
    neonPink: 0xff4fa3,
    neonCyan: 0x37e0d0
  }
};

VB.landmarks = {
  garage: { x: 52, z: -60, r: 14, label: "Duarte Motors" },
  fixerSpot: { x: 44, z: -46, r: 6, label: "Sel's Corner" },
  heroStart: { x: 40, z: -38, r: 3, label: "Rafa's Block" },
  neptuneHotel: { x: -120, z: 120, r: 14, label: "Neptune Hotel" },
  casino: { x: 150, z: -160, r: 16, label: "The Gilded Palm" },
  goldCoupeSpot: { x: 138, z: -146, r: 5, label: "Casino Valet" },
  docks: { x: -200, z: 300, r: 18, label: "Docks Warehouse" },
  marinaPickup: { x: 190, z: 318, r: 10, label: "Marina Dock" },
  boat: { x: 215, z: 330, r: 12, label: "Sel's Boat" },
  bank: { x: -60, z: -190, r: 14, label: "Serrano Bank" },
  hideout: { x: -230, z: 230, r: 16, label: "Sel's Hideout" },
  hospital: { x: 230, z: 60, r: 14, label: "Bay General Hospital" },
  policeStation: { x: -40, z: 250, r: 14, label: "VBPD Station" }
};

VB.story = [
  {
    id: 'first-run',
    title: 'First Run',
    giverLine: 'A package is waiting at the marina dock that the Neptune Hotel needs before the timer runs out.',
    reward: 2000,
    needsCar: null,
    steps: [
      {
        type: 'pickupThenReach',
        pickup: 'marinaPickup',
        target: 'neptuneHotel',
        radius: 12,
        timeLimit: 150,
        setStars: -1,
        spawnRivals: 0
      }
    ]
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giverLine: 'That gold coupe parked at The Gilded Palm casino belongs in my garage, but remember the garage only accepts deliveries when the police aren\'t watching.',
    reward: 3500,
    needsCar: {
      kind: 'sedan',
      color: 0xd8a928,
      atLandmark: 'goldCoupeSpot'
    },
    steps: [
      {
        type: 'deliverCar',
        pickup: null,
        target: 'garage',
        radius: 12,
        timeLimit: 0,
        setStars: -1,
        spawnRivals: 0
      }
    ]
  },
  {
    id: 'hot-cargo',
    title: 'Hot Cargo',
    giverLine: 'There is hot cargo sitting at the docks warehouse that every police unit in the bay will want, so grab it and shake the heat all the way to the hideout.',
    reward: 5000,
    needsCar: null,
    steps: [
      {
        type: 'escape',
        pickup: 'docks',
        target: 'hideout',
        radius: 16,
        timeLimit: 0,
        setStars: 3,
        spawnRivals: 0
      }
    ]
  },
  {
    id: 'dockside-reckoning',
    title: 'Dockside Reckoning',
    giverLine: 'A rival crew is squatting at my docks on foot and needs to be permanently cleared out.',
    reward: 6500,
    needsCar: null,
    steps: [
      {
        type: 'clearRivals',
        pickup: null,
        target: 'docks',
        radius: 30,
        timeLimit: 0,
        setStars: -1,
        spawnRivals: 5
      }
    ]
  },
  {
    id: 'duskline-getaway',
    title: 'Duskline Getaway',
    giverLine: 'This is the last run: get Serrano\'s armored van from his bank to my boat at the marina and your debt is history.',
    reward: 8000,
    needsCar: {
      kind: 'van',
      color: 0x3a4149,
      atLandmark: 'bank'
    },
    steps: [
      {
        type: 'deliverCar',
        pickup: null,
        target: 'boat',
        radius: 14,
        timeLimit: 240,
        setStars: 4,
        spawnRivals: 0
      }
    ]
  },
  {
    id: 'golden-hour-encore',
    title: 'Golden Hour Encore',
    giverLine: 'One for the road, Rafa: Serrano\'s leftover stash sits at the docks — run it to the Gilded Palm\'s vault before the light goes, and keep it quick.',
    reward: 4000,
    needsCar: null,
    steps: [
      {
        type: 'pickupThenReach',
        pickup: 'docks',
        target: 'casino',
        radius: 12,
        timeLimit: 180,
        setStars: -1,
        spawnRivals: 0
      }
    ]
  },
  {
    id: 'night-deposit',
    title: 'Night Deposit',
    giverLine: 'The Gilded Palm banks its night deposit at the casino vault after close. Lift it and run it down to the docks warehouse — the VBPD will not wave you through.',
    reward: 5000,
    needsCar: null,
    steps: [
      {
        type: 'pickupThenReach',
        pickup: 'casino',
        target: 'docks',
        radius: 12,
        timeLimit: 165,
        setStars: 3,
        spawnRivals: 0
      }
    ]
  },
  {
    id: 'bay-king',
    title: 'Bay King',
    giverLine: 'Last job, Rafa — Serrano\'s gold coupe, the one he never lets out of the casino valet. Take it, shake the heat, and put it on my boat at the marina. Then the bay is yours.',
    reward: 7500,
    needsCar: {
      kind: 'sedan',
      color: 0xd8a928,
      atLandmark: 'goldCoupeSpot'
    },
    steps: [
      {
        type: 'deliverCar',
        pickup: null,
        target: 'boat',
        radius: 12,
        timeLimit: 240,
        setStars: -1,
        spawnRivals: 0
      }
    ]
  }
];

VB.race = {
  name: 'Bayfront Sprint',
  prize: 750,
  timeLimit: 150,
  start: { x: 0, z: 318, r: 12 },
  checkpoints: [
    { x: -111, z: 318 },
    { x: -185, z: 185 },
    { x: -185, z: -37 },
    { x: -111, z: -185 },
    { x: 37, z: -259 },
    { x: 185, z: -111 },
    { x: 185, z: 111 },
    { x: 111, z: 259 }
  ],
  finish: { x: 0, z: 318 }
};
