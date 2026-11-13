/* Two guided, fully playable lessons. Uses the unchanged classic-v4 rules. */
window.HEX_TUTORIALS = [
  {
    id: 'learn-1',
    kind: 'tutorial',
    rulesVersion: 'classic-v4',
    name: 'Komşuları değiştir',
    title: 'İlk eşleşmeni yap',
    objective: 'Aynı üç sayıyı hizala ve yedi zemini yeşile boya.',
    subtitle: 'İki komşuyu değiştir; aynı üç sayıyı bir çizgide buluştur.',
    cells: [
      {q:0,r:-1,layers:1},
      {q:-1,r:0,layers:1},
      {q:1,r:-1,layers:1},
      {q:0,r:0,layers:1},
      {q:-1,r:1,layers:1},
      {q:1,r:0,layers:1},
      {q:0,r:1,layers:1}
    ],
    initial: [2,2,3,1,2,2,3],
    seed: 31676,
    palette: [1,2,3],
    moves: 5,
    target: 15,
    par: 3,
    solution: [[4,3],[0,3],[3,5]],
    steps: [
      {
        pair:[4,3],
        text:'Parlayan 2 ve 1’i değiştir. Üç tane 2’yi düz bir çizgide buluştur.',
        afterText:'Üç tane 2 eşleşti: +6 puan. Altlarındaki zemin yeşile döndü.',
        focus:'swap',
        matchIndices:[1,3,5],
        expected:{score:6,covered:3,waves:1}
      },
      {
        pair:[0,3],
        text:'Şimdi parlayan 1 ile 2’yi değiştir. Yeşil olmayan başka bir çizgiye ulaş.',
        afterText:'Sayılar düştü; yeşil zemin yerinde kaldı. Beş zemin artık yeşil.',
        focus:'ground',
        matchIndices:[2,3,4],
        expected:{score:9,covered:5,waves:1}
      },
      {
        pair:[3,5],
        text:'Parlayan 2 ile 3’ü değiştir. Son iki zemini de yeşile boya.',
        afterText:'Bütün zemin yeşil ve puan hedefi tamam. İlk eşleşmelerini başarıyla yaptın.',
        focus:'goal',
        matchIndices:[0,3,6],
        expected:{score:18,covered:7,waves:1}
      }
    ]
  },
  {
    id: 'learn-2',
    kind: 'tutorial',
    rulesVersion: 'classic-v4',
    name: 'Hedef ve zemin',
    title: 'Her hamlenin bir amacı var',
    objective: 'Hamlelerin bitmeden puan hedefini ve yeşil alanı birlikte tamamla.',
    subtitle: 'Zincirleri izle; çift katmanları iki ayrı eşleşmeyle yeşert.',
    cells: [
      {q:-1,r:-1,layers:2},
      {q:0,r:-1,layers:1},
      {q:-1,r:0,layers:1},
      {q:1,r:-1,layers:1},
      {q:0,r:0,layers:2},
      {q:-1,r:1,layers:1},
      {q:1,r:0,layers:1},
      {q:0,r:1,layers:1},
      {q:1,r:1,layers:1}
    ],
    initial: [2,1,3,2,1,2,1,3,2],
    seed: 512,
    palette: [1,2,3],
    moves: 6,
    target: 25,
    par: 4,
    solution: [[2,1],[5,7],[2,1],[2,1]],
    steps: [
      {
        pair:[2,1],
        text:'Parlayan iki komşuyu değiştir. Ortadaki işaretli zeminin ilk katını kaldır.',
        afterText:'İşaretli zemin iki eşleşme ister. Ortadaki zeminde bir kat daha kaldı.',
        focus:'ground',
        matchIndices:[2,4,6],
        expected:{score:3,covered:2,waves:1}
      },
      {
        pair:[5,7],
        text:'Bu takas iki eşleşmeyi peş peşe başlatacak. İkisi de yalnızca bir hamle sayılır.',
        afterText:'Düşen sayılar yeni bir eşleşme kurdu: +15 puan. Ortadaki zemin de yeşillendi.',
        focus:'chain',
        matchIndices:[3,4,5],
        expected:{score:18,covered:7,waves:2}
      },
      {
        pair:[2,1],
        text:'Parlayan taşları değiştir ve puan hedefine ulaş. Üstteki çift katmanlı zemini de aç.',
        afterText:'Puan hedefi tamam; ama bir zemin hâlâ bitmedi. Kazanmak için ikisi de tamamlanmalı.',
        focus:'goal',
        matchIndices:[0,1,3],
        expected:{score:27,covered:8,waves:1}
      },
      {
        pair:[2,1],
        text:'İşaretli son zemini yeşile boya. Hedef puan tamam; şimdi alanı bitir.',
        afterText:'Puan hedefi ve bütün zemin tamam. On bölümlük yolculuğa hazırsın.',
        focus:'goal',
        matchIndices:[0,2,5],
        expected:{score:30,covered:9,waves:1}
      }
    ]
  }
];
