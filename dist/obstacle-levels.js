/* Generated from data/obstacle-levels-v1.json. Development catalog only. */
window.HEX_OBSTACLE_LEVELS = [
  {
    "id": "obstacle-a",
    "rulesVersion": "classic-v5",
    "levelDataVersion": "obstacles-v1",
    "name": "İlk Kutu",
    "subtitle": "Kutunun yanında eşleştir; yeni hücreleri aç.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "layers": 1
      },
      {
        "q": 1,
        "r": -2,
        "layers": 1
      },
      {
        "q": 2,
        "r": -2,
        "layers": 1
      },
      {
        "q": -1,
        "r": -1,
        "layers": 1
      },
      {
        "q": 0,
        "r": -1,
        "layers": 1
      },
      {
        "q": 1,
        "r": -1,
        "layers": 1
      },
      {
        "q": 2,
        "r": -1,
        "layers": 1
      },
      {
        "q": -2,
        "r": 0,
        "layers": 1
      },
      {
        "q": -1,
        "r": 0,
        "layers": 1
      },
      {
        "q": 0,
        "r": 0,
        "layers": 1
      },
      {
        "q": 1,
        "r": 0,
        "layers": 1
      },
      {
        "q": 2,
        "r": 0,
        "layers": 1
      },
      {
        "q": -2,
        "r": 1,
        "layers": 1
      },
      {
        "q": -1,
        "r": 1,
        "layers": 1
      },
      {
        "q": 0,
        "r": 1,
        "layers": 1
      },
      {
        "q": 1,
        "r": 1,
        "layers": 1
      },
      {
        "q": -2,
        "r": 2,
        "layers": 1
      },
      {
        "q": -1,
        "r": 2,
        "layers": 1
      },
      {
        "q": 0,
        "r": 2,
        "layers": 1
      }
    ],
    "initial": [
      2,
      3,
      2,
      1,
      2,
      2,
      3,
      1,
      3,
      null,
      1,
      3,
      2,
      3,
      1,
      3,
      null,
      null,
      null
    ],
    "palette": [
      1,
      2,
      3
    ],
    "seed": 87470069,
    "moves": 35,
    "target": 30,
    "obstacles": {
      "version": "obstacles-v1",
      "blockers": [
        {
          "id": "a-gate",
          "cell": 9,
          "hp": 1,
          "regionId": "a-garden"
        }
      ],
      "regions": [
        {
          "id": "a-garden",
          "cells": [
            16,
            17,
            18
          ],
          "requires": [
            "a-gate"
          ]
        }
      ]
    },
    "solutions": [
      [
        [
          2,
          6
        ],
        [
          14,
          10
        ],
        [
          4,
          9
        ],
        [
          7,
          8
        ],
        [
          1,
          2
        ]
      ],
      [
        [
          3,
          0
        ],
        [
          4,
          5
        ],
        [
          12,
          13
        ],
        [
          4,
          1
        ]
      ]
    ],
    "solution": [
      [
        2,
        6
      ],
      [
        14,
        10
      ],
      [
        4,
        9
      ],
      [
        7,
        8
      ],
      [
        1,
        2
      ]
    ],
    "par": 5
  },
  {
    "id": "obstacle-b",
    "rulesVersion": "classic-v5",
    "levelDataVersion": "obstacles-v1",
    "name": "Kapalı Alt Bölge",
    "subtitle": "Üç kutuyu kır; aşağıdaki bahçeye ulaş.",
    "cells": [
      {
        "q": 0,
        "r": -2,
        "layers": 1
      },
      {
        "q": 1,
        "r": -2,
        "layers": 1
      },
      {
        "q": 2,
        "r": -2,
        "layers": 1
      },
      {
        "q": -1,
        "r": -1,
        "layers": 1
      },
      {
        "q": 0,
        "r": -1,
        "layers": 1
      },
      {
        "q": 1,
        "r": -1,
        "layers": 1
      },
      {
        "q": 2,
        "r": -1,
        "layers": 1
      },
      {
        "q": -2,
        "r": 0,
        "layers": 1
      },
      {
        "q": -1,
        "r": 0,
        "layers": 1
      },
      {
        "q": 0,
        "r": 0,
        "layers": 1
      },
      {
        "q": 1,
        "r": 0,
        "layers": 1
      },
      {
        "q": 2,
        "r": 0,
        "layers": 1
      },
      {
        "q": -2,
        "r": 1,
        "layers": 1
      },
      {
        "q": -1,
        "r": 1,
        "layers": 1
      },
      {
        "q": 0,
        "r": 1,
        "layers": 1
      },
      {
        "q": 1,
        "r": 1,
        "layers": 1
      },
      {
        "q": -2,
        "r": 2,
        "layers": 1
      },
      {
        "q": -1,
        "r": 2,
        "layers": 1
      },
      {
        "q": 0,
        "r": 2,
        "layers": 1
      }
    ],
    "initial": [
      2,
      2,
      3,
      1,
      2,
      2,
      1,
      1,
      null,
      null,
      null,
      3,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    "palette": [
      1,
      2,
      3
    ],
    "seed": 1216754474,
    "moves": 65,
    "target": 90,
    "obstacles": {
      "version": "obstacles-v1",
      "blockers": [
        {
          "id": "b-left",
          "cell": 8,
          "hp": 1,
          "regionId": "b-lower"
        },
        {
          "id": "b-center",
          "cell": 9,
          "hp": 1,
          "regionId": "b-lower"
        },
        {
          "id": "b-right",
          "cell": 10,
          "hp": 1,
          "regionId": "b-lower"
        }
      ],
      "regions": [
        {
          "id": "b-lower",
          "cells": [
            12,
            13,
            14,
            15,
            16,
            17,
            18
          ],
          "requires": [
            "b-left",
            "b-center",
            "b-right"
          ]
        }
      ]
    },
    "solutions": [
      [
        [
          3,
          0
        ],
        [
          9,
          10
        ],
        [
          1,
          5
        ],
        [
          16,
          13
        ],
        [
          7,
          8
        ]
      ],
      [
        [
          5,
          2
        ],
        [
          5,
          6
        ],
        [
          6,
          11
        ],
        [
          0,
          4
        ],
        [
          18,
          15
        ]
      ]
    ],
    "solution": [
      [
        3,
        0
      ],
      [
        9,
        10
      ],
      [
        1,
        5
      ],
      [
        16,
        13
      ],
      [
        7,
        8
      ]
    ],
    "par": 5
  },
  {
    "id": "obstacle-c",
    "rulesVersion": "classic-v5",
    "levelDataVersion": "obstacles-v1",
    "name": "Çok Aşamalı Açılma",
    "subtitle": "Önce sol bahçeyi, sonra güçlendirilmiş geçidi aç.",
    "cells": [
      {
        "q": 0,
        "r": -3,
        "layers": 1
      },
      {
        "q": 1,
        "r": -3,
        "layers": 1
      },
      {
        "q": 2,
        "r": -3,
        "layers": 1
      },
      {
        "q": 3,
        "r": -3,
        "layers": 1
      },
      {
        "q": -1,
        "r": -2,
        "layers": 1
      },
      {
        "q": 0,
        "r": -2,
        "layers": 1
      },
      {
        "q": 1,
        "r": -2,
        "layers": 1
      },
      {
        "q": 2,
        "r": -2,
        "layers": 1
      },
      {
        "q": 3,
        "r": -2,
        "layers": 1
      },
      {
        "q": -2,
        "r": -1,
        "layers": 1
      },
      {
        "q": -1,
        "r": -1,
        "layers": 1
      },
      {
        "q": 0,
        "r": -1,
        "layers": 1
      },
      {
        "q": 1,
        "r": -1,
        "layers": 1
      },
      {
        "q": 2,
        "r": -1,
        "layers": 1
      },
      {
        "q": 3,
        "r": -1,
        "layers": 1
      },
      {
        "q": -3,
        "r": 0,
        "layers": 1
      },
      {
        "q": -2,
        "r": 0,
        "layers": 1
      },
      {
        "q": -1,
        "r": 0,
        "layers": 1
      },
      {
        "q": 0,
        "r": 0,
        "layers": 1
      },
      {
        "q": 1,
        "r": 0,
        "layers": 1
      },
      {
        "q": 2,
        "r": 0,
        "layers": 1
      },
      {
        "q": 3,
        "r": 0,
        "layers": 1
      },
      {
        "q": -3,
        "r": 1,
        "layers": 1
      },
      {
        "q": -2,
        "r": 1,
        "layers": 1
      },
      {
        "q": -1,
        "r": 1,
        "layers": 1
      },
      {
        "q": 0,
        "r": 1,
        "layers": 1
      },
      {
        "q": 1,
        "r": 1,
        "layers": 1
      },
      {
        "q": 2,
        "r": 1,
        "layers": 1
      },
      {
        "q": -3,
        "r": 2,
        "layers": 1
      },
      {
        "q": -2,
        "r": 2,
        "layers": 1
      },
      {
        "q": -1,
        "r": 2,
        "layers": 1
      },
      {
        "q": 0,
        "r": 2,
        "layers": 1
      },
      {
        "q": 1,
        "r": 2,
        "layers": 1
      },
      {
        "q": -3,
        "r": 3,
        "layers": 1
      },
      {
        "q": -2,
        "r": 3,
        "layers": 1
      },
      {
        "q": -1,
        "r": 3,
        "layers": 1
      },
      {
        "q": 0,
        "r": 3,
        "layers": 1
      }
    ],
    "initial": [
      2,
      2,
      3,
      2,
      3,
      2,
      1,
      1,
      2,
      2,
      3,
      1,
      3,
      3,
      1,
      1,
      1,
      null,
      3,
      null,
      1,
      2,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    "palette": [
      1,
      2,
      3
    ],
    "seed": 4283899417,
    "moves": 95,
    "target": 150,
    "obstacles": {
      "version": "obstacles-v1",
      "blockers": [
        {
          "id": "c-first",
          "cell": 17,
          "hp": 1,
          "regionId": "c-west"
        },
        {
          "id": "c-side",
          "cell": 19,
          "hp": 1,
          "regionId": "c-east"
        },
        {
          "id": "c-reinforced",
          "cell": 30,
          "hp": 2,
          "regionId": "c-east"
        }
      ],
      "regions": [
        {
          "id": "c-west",
          "cells": [
            22,
            23,
            24,
            28,
            29,
            30,
            33,
            34,
            35
          ],
          "requires": [
            "c-first"
          ]
        },
        {
          "id": "c-east",
          "cells": [
            25,
            26,
            27,
            31,
            32,
            36
          ],
          "requires": [
            "c-side",
            "c-reinforced"
          ]
        }
      ]
    },
    "solutions": [
      [
        [
          2,
          3
        ],
        [
          0,
          5
        ],
        [
          11,
          12
        ],
        [
          3,
          8
        ]
      ],
      [
        [
          2,
          7
        ],
        [
          7,
          13
        ],
        [
          28,
          29
        ],
        [
          0,
          5
        ]
      ]
    ],
    "solution": [
      [
        2,
        3
      ],
      [
        0,
        5
      ],
      [
        11,
        12
      ],
      [
        3,
        8
      ]
    ],
    "par": 4
  }
];
