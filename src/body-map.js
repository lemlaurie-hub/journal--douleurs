// Zones proposées par la carte Rhumato. La face choisie détermine la liste
// des précisions afin de ne jamais proposer, par exemple, les lombaires sur
// la vue de face.
export const BODY_MAP_REGIONS = {
  neck: {
    name: 'Cou',
    front: ['Avant du cou'],
    back: ['Nuque', 'Base du crâne']
  },
  'shoulder-right': {
    name: 'Épaule droite',
    front: ['Avant de l’épaule droite', 'Clavicule droite'],
    back: ['Arrière de l’épaule droite', 'Omoplate droite']
  },
  'shoulder-left': {
    name: 'Épaule gauche',
    front: ['Avant de l’épaule gauche', 'Clavicule gauche'],
    back: ['Arrière de l’épaule gauche', 'Omoplate gauche']
  },
  trunk: {
    name: 'Torse',
    front: ['Côtes droites', 'Côtes gauches', 'Sternum', 'Ventre'],
    back: ['Haut du dos', 'Milieu du dos', 'Lombaires', 'Sacrum']
  },
  'arm-right': {
    name: 'Bras droit',
    front: ['Bras droit', 'Coude droit (avant)', 'Avant-bras droit'],
    back: ['Arrière du bras droit', 'Coude droit (arrière)', 'Arrière de l’avant-bras droit']
  },
  'arm-left': {
    name: 'Bras gauche',
    front: ['Bras gauche', 'Coude gauche (avant)', 'Avant-bras gauche'],
    back: ['Arrière du bras gauche', 'Coude gauche (arrière)', 'Arrière de l’avant-bras gauche']
  },
  'hand-right': {
    name: 'Main droite',
    front: ['Poignet droit', 'Paume droite', 'Doigts de la main droite'],
    back: ['Poignet droit', 'Dos de la main droite', 'Doigts de la main droite']
  },
  'hand-left': {
    name: 'Main gauche',
    front: ['Poignet gauche', 'Paume gauche', 'Doigts de la main gauche'],
    back: ['Poignet gauche', 'Dos de la main gauche', 'Doigts de la main gauche']
  },
  'hip-right': {
    name: 'Hanche droite',
    front: ['Avant de la hanche droite', 'Aine droite'],
    back: ['Arrière de la hanche droite', 'Fesse droite']
  },
  'hip-left': {
    name: 'Hanche gauche',
    front: ['Avant de la hanche gauche', 'Aine gauche'],
    back: ['Arrière de la hanche gauche', 'Fesse gauche']
  },
  'leg-right': {
    name: 'Jambe droite',
    front: ['Avant de la cuisse droite', 'Genou droit (avant)', 'Tibia droit'],
    back: ['Arrière de la cuisse droite', 'Genou droit (arrière)', 'Mollet droit']
  },
  'leg-left': {
    name: 'Jambe gauche',
    front: ['Avant de la cuisse gauche', 'Genou gauche (avant)', 'Tibia gauche'],
    back: ['Arrière de la cuisse gauche', 'Genou gauche (arrière)', 'Mollet gauche']
  },
  'foot-right': {
    name: 'Pied droit',
    front: ['Pied droit — ensemble', 'Dessus du pied droit', 'Orteils droits', 'Cheville droite (avant)'],
    back: ['Pied droit — ensemble', 'Plante du pied droit', 'Talon droit', 'Cheville droite (arrière)']
  },
  'foot-left': {
    name: 'Pied gauche',
    front: ['Pied gauche — ensemble', 'Dessus du pied gauche', 'Orteils gauches', 'Cheville gauche (avant)'],
    back: ['Pied gauche — ensemble', 'Plante du pied gauche', 'Talon gauche', 'Cheville gauche (arrière)']
  }
};

export function getBodyMapDetails(regionId, surface) {
  if (!['front', 'back'].includes(surface)) return [];
  return BODY_MAP_REGIONS[regionId]?.[surface] || [];
}
