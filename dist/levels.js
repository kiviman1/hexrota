/* Ten authored, verified routes. Axial coordinates; each visit adds its tile value. */
window.HEX_LEVELS = [
  {
    "name": "İlk kıvılcım",
    "subtitle": "Bir taştan başla, bütün alanı yeşile boya.",
    "cells": [
      {
        "q": 0,
        "r": -1,
        "value": 1,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": -1,
        "r": 1,
        "value": 3,
        "cap": 1
      },
      {
        "q": 1,
        "r": 0,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 3,
        "cap": 1
      }
    ],
    "target": 13,
    "solution": [
      1,
      4,
      6,
      5,
      3,
      0,
      2
    ]
  },
  {
    "name": "Yeni bir yön",
    "subtitle": "Her adımda komşu bir altıgene ilerle.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "value": 3,
        "cap": 1
      },
      {
        "q": 1,
        "r": -2,
        "value": 2,
        "cap": 1
      },
      {
        "q": 0,
        "r": -1,
        "value": 2,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 2,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": -1,
        "r": 1,
        "value": 2,
        "cap": 1
      },
      {
        "q": 1,
        "r": 0,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 3,
        "cap": 1
      }
    ],
    "target": 19,
    "solution": [
      0,
      1,
      4,
      7,
      8,
      6,
      3,
      5,
      2
    ]
  },
  {
    "name": "İkinci şans",
    "subtitle": "Çift halkalı bir taşı ikinci kez kullanabilirsin.",
    "cells": [
      {
        "q": 0,
        "r": -1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 2,
        "r": -2,
        "value": 2,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 1,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 5,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 8,
        "cap": 2
      },
      {
        "q": 2,
        "r": -1,
        "value": 2,
        "cap": 1
      },
      {
        "q": -1,
        "r": 1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 1,
        "r": 0,
        "value": 3,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 9,
        "cap": 2
      },
      {
        "q": 2,
        "r": 0,
        "value": 5,
        "cap": 1
      },
      {
        "q": 1,
        "r": 1,
        "value": 3,
        "cap": 1
      }
    ],
    "target": 48,
    "solution": [
      1,
      5,
      9,
      10,
      8,
      6,
      2,
      0,
      3,
      4,
      7,
      4
    ]
  },
  {
    "name": "Küçük bir düğüm",
    "subtitle": "Hedef için doğru taşı yeniden ziyaret et.",
    "cells": [
      {
        "q": 0,
        "r": -1,
        "value": 2,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 4,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 1,
        "cap": 1
      },
      {
        "q": -1,
        "r": 1,
        "value": 1,
        "cap": 2
      },
      {
        "q": 1,
        "r": 0,
        "value": 5,
        "cap": 1
      },
      {
        "q": -2,
        "r": 2,
        "value": 4,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 4,
        "cap": 1
      },
      {
        "q": 2,
        "r": 0,
        "value": 3,
        "cap": 2
      },
      {
        "q": -1,
        "r": 2,
        "value": 5,
        "cap": 1
      },
      {
        "q": 1,
        "r": 1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 2,
        "value": 3,
        "cap": 1
      }
    ],
    "target": 35,
    "solution": [
      8,
      10,
      11,
      9,
      4,
      6,
      4,
      7,
      5,
      2,
      3,
      1,
      0
    ]
  },
  {
    "name": "Yol ayrımı",
    "subtitle": "İki dönüş, tek kusursuz rota.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "value": 4,
        "cap": 1
      },
      {
        "q": -1,
        "r": -1,
        "value": 5,
        "cap": 1
      },
      {
        "q": -2,
        "r": 0,
        "value": 3,
        "cap": 1
      },
      {
        "q": 0,
        "r": -1,
        "value": 2,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 4,
        "cap": 1
      },
      {
        "q": -2,
        "r": 1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 4,
        "cap": 1
      },
      {
        "q": -1,
        "r": 1,
        "value": 8,
        "cap": 2
      },
      {
        "q": 1,
        "r": 0,
        "value": 3,
        "cap": 1
      },
      {
        "q": -2,
        "r": 2,
        "value": 2,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 1,
        "cap": 2
      },
      {
        "q": -1,
        "r": 2,
        "value": 4,
        "cap": 1
      },
      {
        "q": 0,
        "r": 2,
        "value": 4,
        "cap": 2
      }
    ],
    "target": 56,
    "solution": [
      0,
      1,
      2,
      6,
      10,
      8,
      12,
      11,
      13,
      11,
      8,
      4,
      3,
      5,
      7,
      9
    ]
  },
  {
    "name": "Yeşil döngü",
    "subtitle": "Her yeşil taş yolun bittiği anlamına gelmez.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "value": 9,
        "cap": 1
      },
      {
        "q": -1,
        "r": -1,
        "value": 9,
        "cap": 1
      },
      {
        "q": 1,
        "r": -2,
        "value": 2,
        "cap": 1
      },
      {
        "q": -2,
        "r": 0,
        "value": 5,
        "cap": 1
      },
      {
        "q": 0,
        "r": -1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 2,
        "r": -2,
        "value": 8,
        "cap": 2
      },
      {
        "q": -1,
        "r": 0,
        "value": 5,
        "cap": 2
      },
      {
        "q": 1,
        "r": -1,
        "value": 6,
        "cap": 1
      },
      {
        "q": -2,
        "r": 1,
        "value": 6,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 5,
        "cap": 1
      },
      {
        "q": 2,
        "r": -1,
        "value": 8,
        "cap": 1
      },
      {
        "q": -1,
        "r": 1,
        "value": 2,
        "cap": 2
      },
      {
        "q": 1,
        "r": 0,
        "value": 9,
        "cap": 1
      },
      {
        "q": -2,
        "r": 2,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 3,
        "cap": 2
      }
    ],
    "target": 86,
    "solution": [
      13,
      11,
      8,
      3,
      1,
      0,
      2,
      5,
      10,
      7,
      12,
      14,
      11,
      6,
      9,
      6,
      4
    ]
  },
  {
    "name": "İnce hesap",
    "subtitle": "Rotanı kurarken toplamını da düşün.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "value": 7,
        "cap": 1
      },
      {
        "q": -1,
        "r": -1,
        "value": 5,
        "cap": 1
      },
      {
        "q": 1,
        "r": -2,
        "value": 8,
        "cap": 1
      },
      {
        "q": -2,
        "r": 0,
        "value": 9,
        "cap": 1
      },
      {
        "q": 0,
        "r": -1,
        "value": 5,
        "cap": 2
      },
      {
        "q": 2,
        "r": -2,
        "value": 8,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 4,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 5,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 4,
        "cap": 1
      },
      {
        "q": 2,
        "r": -1,
        "value": 9,
        "cap": 2
      },
      {
        "q": -1,
        "r": 1,
        "value": 2,
        "cap": 1
      },
      {
        "q": 1,
        "r": 0,
        "value": 2,
        "cap": 2
      },
      {
        "q": 0,
        "r": 1,
        "value": 3,
        "cap": 2
      },
      {
        "q": 2,
        "r": 0,
        "value": 6,
        "cap": 1
      },
      {
        "q": -1,
        "r": 2,
        "value": 1,
        "cap": 2
      },
      {
        "q": 1,
        "r": 1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 0,
        "r": 2,
        "value": 1,
        "cap": 1
      }
    ],
    "target": 86,
    "solution": [
      3,
      1,
      0,
      2,
      5,
      9,
      11,
      13,
      15,
      16,
      14,
      12,
      14,
      12,
      11,
      7,
      4,
      6,
      8,
      10
    ]
  },
  {
    "name": "Altı yön",
    "subtitle": "Altı yön, birçok olasılık, bir hedef.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "value": 5,
        "cap": 1
      },
      {
        "q": -1,
        "r": -1,
        "value": 6,
        "cap": 1
      },
      {
        "q": 1,
        "r": -2,
        "value": 8,
        "cap": 2
      },
      {
        "q": -2,
        "r": 0,
        "value": 5,
        "cap": 1
      },
      {
        "q": 0,
        "r": -1,
        "value": 7,
        "cap": 1
      },
      {
        "q": 2,
        "r": -2,
        "value": 3,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 1,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 7,
        "cap": 1
      },
      {
        "q": -2,
        "r": 1,
        "value": 4,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 5,
        "cap": 2
      },
      {
        "q": 2,
        "r": -1,
        "value": 6,
        "cap": 1
      },
      {
        "q": -1,
        "r": 1,
        "value": 6,
        "cap": 2
      },
      {
        "q": 1,
        "r": 0,
        "value": 5,
        "cap": 1
      },
      {
        "q": -2,
        "r": 2,
        "value": 9,
        "cap": 2
      },
      {
        "q": 0,
        "r": 1,
        "value": 1,
        "cap": 1
      },
      {
        "q": 2,
        "r": 0,
        "value": 4,
        "cap": 1
      },
      {
        "q": -1,
        "r": 2,
        "value": 7,
        "cap": 2
      },
      {
        "q": 1,
        "r": 1,
        "value": 3,
        "cap": 1
      },
      {
        "q": 0,
        "r": 2,
        "value": 5,
        "cap": 1
      }
    ],
    "target": 117,
    "solution": [
      13,
      16,
      18,
      17,
      15,
      10,
      5,
      2,
      0,
      1,
      3,
      8,
      13,
      11,
      14,
      9,
      12,
      7,
      9,
      11,
      6,
      4
    ]
  },
  {
    "name": "Son viraj",
    "subtitle": "Küçük dönüşler büyük fark yaratır.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "value": 8,
        "cap": 1
      },
      {
        "q": 2,
        "r": -3,
        "value": 7,
        "cap": 1
      },
      {
        "q": -1,
        "r": -1,
        "value": 8,
        "cap": 2
      },
      {
        "q": 1,
        "r": -2,
        "value": 6,
        "cap": 1
      },
      {
        "q": 3,
        "r": -3,
        "value": 3,
        "cap": 1
      },
      {
        "q": -2,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": 0,
        "r": -1,
        "value": 1,
        "cap": 2
      },
      {
        "q": 2,
        "r": -2,
        "value": 2,
        "cap": 2
      },
      {
        "q": -1,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 4,
        "cap": 2
      },
      {
        "q": -2,
        "r": 1,
        "value": 3,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 3,
        "cap": 2
      },
      {
        "q": 2,
        "r": -1,
        "value": 7,
        "cap": 2
      },
      {
        "q": -1,
        "r": 1,
        "value": 3,
        "cap": 1
      },
      {
        "q": 1,
        "r": 0,
        "value": 1,
        "cap": 1
      },
      {
        "q": -2,
        "r": 2,
        "value": 9,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 7,
        "cap": 1
      },
      {
        "q": 2,
        "r": 0,
        "value": 4,
        "cap": 1
      },
      {
        "q": -1,
        "r": 2,
        "value": 5,
        "cap": 1
      },
      {
        "q": 1,
        "r": 1,
        "value": 7,
        "cap": 1
      },
      {
        "q": 0,
        "r": 2,
        "value": 7,
        "cap": 1
      }
    ],
    "target": 109,
    "solution": [
      4,
      7,
      1,
      7,
      12,
      17,
      19,
      20,
      18,
      15,
      10,
      5,
      2,
      0,
      6,
      3,
      9,
      6,
      11,
      8,
      13,
      16,
      11,
      9,
      14
    ]
  },
  {
    "name": "Usta rotası",
    "subtitle": "Öğrendiğin her şeyi bu rotada birleştir.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "value": 3,
        "cap": 1
      },
      {
        "q": -1,
        "r": -1,
        "value": 7,
        "cap": 1
      },
      {
        "q": 1,
        "r": -2,
        "value": 2,
        "cap": 1
      },
      {
        "q": -2,
        "r": 0,
        "value": 6,
        "cap": 1
      },
      {
        "q": 0,
        "r": -1,
        "value": 5,
        "cap": 2
      },
      {
        "q": 2,
        "r": -2,
        "value": 1,
        "cap": 1
      },
      {
        "q": -1,
        "r": 0,
        "value": 4,
        "cap": 1
      },
      {
        "q": 1,
        "r": -1,
        "value": 7,
        "cap": 2
      },
      {
        "q": -2,
        "r": 1,
        "value": 5,
        "cap": 1
      },
      {
        "q": 0,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": 2,
        "r": -1,
        "value": 8,
        "cap": 2
      },
      {
        "q": -1,
        "r": 1,
        "value": 6,
        "cap": 2
      },
      {
        "q": 1,
        "r": 0,
        "value": 2,
        "cap": 1
      },
      {
        "q": 3,
        "r": -1,
        "value": 5,
        "cap": 1
      },
      {
        "q": -2,
        "r": 2,
        "value": 4,
        "cap": 1
      },
      {
        "q": 0,
        "r": 1,
        "value": 6,
        "cap": 1
      },
      {
        "q": 2,
        "r": 0,
        "value": 3,
        "cap": 2
      },
      {
        "q": -1,
        "r": 2,
        "value": 5,
        "cap": 1
      },
      {
        "q": 1,
        "r": 1,
        "value": 1,
        "cap": 2
      },
      {
        "q": 3,
        "r": 0,
        "value": 9,
        "cap": 2
      },
      {
        "q": 0,
        "r": 2,
        "value": 7,
        "cap": 1
      },
      {
        "q": 2,
        "r": 1,
        "value": 8,
        "cap": 1
      },
      {
        "q": 1,
        "r": 2,
        "value": 2,
        "cap": 1
      }
    ],
    "target": 125,
    "solution": [
      19,
      13,
      10,
      16,
      10,
      5,
      2,
      0,
      1,
      3,
      8,
      14,
      17,
      11,
      6,
      4,
      7,
      4,
      9,
      15,
      12,
      16,
      21,
      22,
      18,
      20,
      18
    ]
  }
];
