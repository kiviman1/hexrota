/* Two guided, fully playable lessons. Uses the unchanged classic-v4 rules. */
window.HEX_TUTORIALS = [
  {
    id: 'learn-1',
    kind: 'tutorial',
    rulesVersion: 'classic-v4',
    name: '3 aynı sayıyı sırala',
    title: 'İlk eşleşmeni yap',
    objective: 'İki komşuyu değiştir, 3 aynı sayıyı bir çizgide buluştur.',
    subtitle: 'Birlikte deneyelim: işaretli iki taşı değiştir, üç tane 2’yi sırala.',
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
        title:'İşaretli 2’yi 1’e kaydır',
        text:'2’yi yanındaki işaretli 1’e kaydır. İstersen ikisine sırayla dokun.',
        afterTitle:'2 + 2 + 2 = 6 puan',
        afterText:'Taşların sayıları toplandı: +6 puan. Taşlar değişir; yeşil zemin kalır.',
        acknowledge:true,
        focus:'swap',
        matchIndices:[1,3,5],
        expected:{score:6,covered:3,waves:1}
      },
      {
        pair:[0,3],
        title:'Şimdi başka bir üçlü yap',
        text:'İşaretli iki taşı değiştir. Aynı üç sayı bu kez çapraz çizgide buluşsun.',
        afterTitle:'Yeşil zemin kalıcıdır',
        afterText:'Eşleşen sayıların toplamı puanına eklendi. Yeni taşlar geldi, yeşil zeminler yerinde kaldı.',
        focus:'ground',
        matchIndices:[2,3,4],
        expected:{score:9,covered:5,waves:1}
      },
      {
        pair:[3,5],
        title:'Son iki zemini yeşert',
        text:'İşaretli 2 ile 3’ü değiştir. Bu eşleşme kalan iki zemini de yeşile boyayacak.',
        afterTitle:'İlk eşleşmelerin tamam!',
        afterText:'Sayılar eşleşti, puanın arttı ve bütün zemin yeşil oldu. Şimdi iki hedefi birlikte tanıyalım.',
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
    name: 'İki hedefi de tamamla',
    title: 'Puan ve yeşil zemin',
    objective: 'Hamlelerin bitmeden puan hedefini ve yeşil alanı birlikte tamamla.',
    subtitle: 'Hamlelerin bitmeden hedef puana ulaş ve bütün zemini yeşile boya.',
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
        title:'İki nokta, iki eşleşme',
        text:'İşaretli 3 ile 1’i değiştir. Alttaki iki küçük nokta, zeminin iki kez eşleşmesi gerektiğini gösterir.',
        afterTitle:'Bir nokta kaldı',
        afterText:'İki nokta iki eşleşme ister. Ortadaki tek nokta, bir eşleşme daha gerektiğini gösterir.',
        acknowledge:true,
        focus:'ground',
        matchIndices:[2,4,6],
        expected:{score:3,covered:2,waves:1}
      },
      {
        pair:[5,7],
        title:'Bir hamle, iki eşleşme',
        text:'İşaretli iki taşı değiştir. İlk eşleşmeden sonra düşen sayıları izle.',
        afterTitle:'Bu bir zincir!',
        afterText:'Düşen sayılar da eşleşti: toplam +15 puan, yalnızca bir hamle. Ortadaki zemin artık kalıcı olarak yeşil.',
        focus:'chain',
        matchIndices:[3,4,5],
        expected:{score:18,covered:7,waves:2}
      },
      {
        pair:[2,1],
        title:'Önce puan hedefine ulaş',
        text:'İşaretli iki taşı değiştir. Sonra üstteki iki hedefe bak: ikisi de tamamlanmalı.',
        afterTitle:'Puan tamam, bir zemin kaldı',
        afterText:'Puan tamam. Son zemini de yeşert; iki hedef de tamamlanınca kazanırsın.',
        acknowledge:true,
        focus:'goal',
        matchIndices:[0,1,3],
        expected:{score:27,covered:8,waves:1}
      },
      {
        pair:[2,1],
        title:'Şimdi son zemini yeşert',
        text:'İşaretli iki taşı değiştir. Son zemin yeşerince iki hedef de tamamlanacak.',
        afterTitle:'İki hedef de tamam!',
        afterText:'Puanın yeterli ve bütün zemin kalıcı olarak yeşil. On bölümlük yolculuğa hazırsın.',
        focus:'goal',
        matchIndices:[0,2,5],
        expected:{score:30,covered:9,waves:1}
      }
    ]
  }
];
