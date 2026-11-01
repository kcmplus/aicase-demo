export default {
  "version": 2,
  "signupCredits": 3,
  "ai_generation_connected": true,
  "ai_provider": "openai",
  "plans": [
    {
      "kind": "print",
      "price": "9.90",
      "currency": "USD",
      "monthly_credits": 0,
      "trial_credits": 0
    },
    {
      "kind": "ai_monthly",
      "price": "5.99",
      "currency": "USD",
      "monthly_credits": 15,
      "trial_credits": 3
    }
  ],
  "ai_styles": [
    {
      "code": "anime",
      "name": "Anime portrait",
      "description": "Expressive eyes, clean linework and a hand-painted world.",
      "image_path": "./assets/ai-styles/anime.png"
    },
    {
      "code": "realism",
      "name": "Cinematic realism",
      "description": "Natural detail, beautiful light and an editorial finish.",
      "image_path": "./assets/ai-styles/realism.png"
    },
    {
      "code": "3d",
      "name": "3D character",
      "description": "A sculpted character with soft materials and studio lighting.",
      "image_path": "./assets/ai-styles/3d.png"
    },
    {
      "code": "gouache",
      "name": "Warm gouache",
      "description": "A warm gouache and crayon illustration that keeps your pet’s unique features.",
      "image_path": "/assets/ai-recipes/pet-gouache.png",
      "sort_order": 3,
      "name_zh": "温暖水粉手绘",
      "description_zh": "保留宠物特征的水粉与蜡笔插画。"
    },
    {
      "code": "scrapbook",
      "name": "Travel scrapbook",
      "description": "Real photo memories surrounded by coastal fragments and tactile paper.",
      "image_path": "/assets/ai-recipes/couple-scrapbook.png",
      "sort_order": 4,
      "name_zh": "旅行照片拼贴",
      "description_zh": "保留人物的真实照片，搭配海岸碎片和纸张肌理。"
    },
    {
      "code": "watercolor",
      "name": "Alpine watercolor",
      "description": "Luminous watercolor and delicate colored pencil for your travel memories.",
      "image_path": "/assets/ai-recipes/lake-watercolor.png",
      "sort_order": 5,
      "name_zh": "清透山湖水彩",
      "description_zh": "把旅行风景转换成透亮水彩和细腻彩铅。"
    },
    {
      "code": "star-collage",
      "name": "Pop star collage",
      "name_zh": "复古星星拼贴",
      "description": "Black-and-white photo cutouts, paper edges and bright screen-printed stars.",
      "description_zh": "黑白人物剪贴、纸边与明亮星芒，形成复古杂志拼贴。",
      "image_path": "/assets/ai-style-pack/star-collage.png",
      "sort_order": 10
    },
    {
      "code": "vinyl-sleeve",
      "name": "Vintage record sleeve",
      "name_zh": "复古唱片封面",
      "description": "A nostalgic duotone portrait with faded ink and gently worn record-sleeve texture.",
      "description_zh": "双色人像、褪色油墨与唱片纸套磨损质感。",
      "image_path": "/assets/ai-style-pack/vinyl-sleeve.png",
      "sort_order": 11
    },
    {
      "code": "silver-relief",
      "name": "Silver relief",
      "name_zh": "银色压印浮雕",
      "description": "A recognizable portrait sculpted in softly brushed silver with tactile relief.",
      "description_zh": "将照片转为拉丝银色浅浮雕，保留可辨认的人像轮廓。",
      "image_path": "/assets/ai-style-pack/silver-relief.png",
      "sort_order": 12
    },
    {
      "code": "block-print",
      "name": "Carved postcard",
      "name_zh": "手刻版画明信片",
      "description": "Carved lines, limited-color ink and textured paper turn scenery into a collectible print.",
      "description_zh": "手刻线条、套色油墨与纸纹，把旅行风景变成版画。",
      "image_path": "/assets/ai-style-pack/block-print.png",
      "sort_order": 13
    },
    {
      "code": "impasto-miniature",
      "name": "Painted miniature",
      "name_zh": "厚涂立体微景观",
      "description": "A tiny landscape built from thick paint, palette-knife ridges and soft dimensional shadows.",
      "description_zh": "用厚重颜料、刮刀肌理和柔和阴影构成立体小世界。",
      "image_path": "/assets/ai-style-pack/impasto-miniature.png",
      "sort_order": 14
    },
    {
      "code": "pet-pop-stickers",
      "name": "Pet pop stickers",
      "name_zh": "宠物波普贴纸",
      "description": "Your pet becomes a lively collage of photo stickers, bold dots and hand-drawn stars.",
      "description_zh": "同一只宠物的照片贴纸搭配波点、星星与鲜明色块。",
      "image_path": "/assets/ai-style-pack/pet-pop-stickers.png",
      "sort_order": 15
    },
    {
      "code": "oil-pastel-pet",
      "name": "Oil pastel companion",
      "name_zh": "油画棒宠物肖像",
      "description": "Soft waxy strokes and layered pastel color give your companion a warm handmade portrait.",
      "description_zh": "柔软蜡质笔触与叠色颗粒，绘出温暖的宠物肖像。",
      "image_path": "/assets/ai-style-pack/oil-pastel-pet.png",
      "sort_order": 16
    },
    {
      "code": "geometric-paper",
      "name": "Geometric paper cut",
      "name_zh": "几何剪纸拼贴",
      "description": "Cut-paper shapes and delicate print texture turn a shared memory into a bold graphic composition.",
      "description_zh": "几何纸片、剪裁边缘与印刷肌理，把合照变为鲜明图形。",
      "image_path": "/assets/ai-style-pack/geometric-paper.png",
      "sort_order": 17
    }
  ],
  "ai_examples": [
    {
      "code": "portrait",
      "name": "Portrait",
      "subject": "Seaside portrait",
      "original_path": "./assets/ai-styles/original.png",
      "results": [
        {
          "style_code": "anime",
          "image_path": "./assets/ai-styles/anime.png"
        },
        {
          "style_code": "realism",
          "image_path": "./assets/ai-styles/realism.png"
        },
        {
          "style_code": "3d",
          "image_path": "./assets/ai-styles/3d.png"
        }
      ]
    },
    {
      "code": "pets",
      "name": "Pets",
      "subject": "A little best friend",
      "original_path": "./assets/ai-styles/pets-original.png",
      "results": [
        {
          "style_code": "anime",
          "image_path": "./assets/ai-styles/pets-anime.png"
        },
        {
          "style_code": "realism",
          "image_path": "./assets/ai-styles/pets-realism.png"
        },
        {
          "style_code": "3d",
          "image_path": "./assets/ai-styles/pets-3d.png"
        }
      ]
    },
    {
      "code": "couples",
      "name": "Couples",
      "subject": "Better together",
      "original_path": "./assets/ai-styles/couples-original.png",
      "results": [
        {
          "style_code": "anime",
          "image_path": "./assets/ai-styles/couples-anime.png"
        },
        {
          "style_code": "realism",
          "image_path": "./assets/ai-styles/couples-realism.png"
        },
        {
          "style_code": "3d",
          "image_path": "./assets/ai-styles/couples-3d.png"
        }
      ]
    },
    {
      "code": "travel",
      "name": "Travel",
      "subject": "Somewhere worth keeping",
      "original_path": "./assets/ai-styles/travel-original.png",
      "results": [
        {
          "style_code": "anime",
          "image_path": "./assets/ai-styles/travel-anime.png"
        },
        {
          "style_code": "realism",
          "image_path": "./assets/ai-styles/travel-realism.png"
        },
        {
          "style_code": "3d",
          "image_path": "./assets/ai-styles/travel-3d.png"
        }
      ]
    },
    {
      "code": "pet-gouache",
      "name": "Painted best friend",
      "subject": "A golden retriever in warm gouache, with room for an iPhone 15 Pro camera.",
      "original_path": "/assets/ai-styles/pets-original.png",
      "style": "gouache",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-recipes/pet-gouache.png",
      "sort_order": 0,
      "name_zh": "宠物手绘 · 镜头避让",
      "subject_zh": "金毛与红领巾的水粉手绘；iPhone 15 Pro 构图预览。",
      "results": [
        {
          "style_code": "gouache",
          "image_path": "/assets/ai-recipes/pet-gouache.png"
        }
      ]
    },
    {
      "code": "couple-scrapbook",
      "name": "Coastal memories",
      "subject": "A travel-scrapbook collage of two people by the sea, composed for iPhone 15 Pro.",
      "original_path": "/assets/ai-styles/couples-original.png",
      "style": "scrapbook",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-recipes/couple-scrapbook.png",
      "sort_order": 1,
      "name_zh": "情侣拼贴 · 海岸记忆",
      "subject_zh": "保留两人合照的旅行手账拼贴；iPhone 15 Pro 构图预览。",
      "results": [
        {
          "style_code": "scrapbook",
          "image_path": "/assets/ai-recipes/couple-scrapbook.png"
        }
      ]
    },
    {
      "code": "lake-watercolor",
      "name": "Alpine escape",
      "subject": "A luminous watercolor lake, cabin and rowboat, composed for iPhone 15 Pro.",
      "original_path": "/assets/ai-styles/travel-original.png",
      "style": "watercolor",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-recipes/lake-watercolor.png",
      "sort_order": 2,
      "name_zh": "山湖水彩 · 旅行留白",
      "subject_zh": "山湖、小屋与木船的清透水彩；iPhone 15 Pro 构图预览。",
      "results": [
        {
          "style_code": "watercolor",
          "image_path": "/assets/ai-recipes/lake-watercolor.png"
        }
      ]
    },
    {
      "code": "portrait-star-collage",
      "name": "Daisy in the spotlight",
      "name_zh": "雏菊女孩 · 星星拼贴",
      "subject": "A seaside portrait with monochrome paper cutouts and vivid starbursts.",
      "subject_zh": "海边人像转为黑白剪贴与彩色星芒。",
      "original_path": "/assets/ai-styles/original.png",
      "style": "star-collage",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/star-collage.png",
      "sort_order": 20,
      "source_reference": "3.png",
      "results": [
        {
          "style_code": "star-collage",
          "image_path": "/assets/ai-style-pack/star-collage.png"
        }
      ]
    },
    {
      "code": "portrait-vinyl-sleeve",
      "name": "Seaside on vinyl",
      "name_zh": "海边女孩 · 复古唱片",
      "subject": "The same portrait reimagined as a text-free vintage record-sleeve artwork.",
      "subject_zh": "同一张人像转为无文字复古唱片封面。",
      "original_path": "/assets/ai-styles/original.png",
      "style": "vinyl-sleeve",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/vinyl-sleeve.png",
      "sort_order": 21,
      "source_reference": "4.png",
      "results": [
        {
          "style_code": "vinyl-sleeve",
          "image_path": "/assets/ai-style-pack/vinyl-sleeve.png"
        }
      ]
    },
    {
      "code": "portrait-silver-relief",
      "name": "Daisy in silver",
      "name_zh": "雏菊女孩 · 银色浮雕",
      "subject": "A brushed-silver relief study of the original portrait and flower.",
      "subject_zh": "原有人像与雏菊的银色浅浮雕效果。",
      "original_path": "/assets/ai-styles/original.png",
      "style": "silver-relief",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/silver-relief.png",
      "sort_order": 22,
      "source_reference": "5.png",
      "results": [
        {
          "style_code": "silver-relief",
          "image_path": "/assets/ai-style-pack/silver-relief.png"
        }
      ]
    },
    {
      "code": "travel-block-print",
      "name": "Alpine block print",
      "name_zh": "山湖旅行 · 手刻版画",
      "subject": "Mountains, a red cabin and one rowboat in a tactile carved landscape print.",
      "subject_zh": "山峰、红色小屋与木船的套色版画。",
      "original_path": "/assets/ai-styles/travel-original.png",
      "style": "block-print",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/block-print.png",
      "sort_order": 23,
      "source_reference": "6.png",
      "results": [
        {
          "style_code": "block-print",
          "image_path": "/assets/ai-style-pack/block-print.png"
        }
      ]
    },
    {
      "code": "travel-impasto-miniature",
      "name": "A lake in miniature",
      "name_zh": "山湖旅行 · 厚涂微景观",
      "subject": "The same alpine lake becomes a small dimensional world made of thick paint.",
      "subject_zh": "将同一片山湖转为颜料堆叠的微景观。",
      "original_path": "/assets/ai-styles/travel-original.png",
      "style": "impasto-miniature",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/impasto-miniature.png",
      "sort_order": 24,
      "source_reference": "7.png",
      "results": [
        {
          "style_code": "impasto-miniature",
          "image_path": "/assets/ai-style-pack/impasto-miniature.png"
        }
      ]
    },
    {
      "code": "pets-pet-pop-stickers",
      "name": "One very good dog",
      "name_zh": "金毛伙伴 · 波普贴纸",
      "subject": "A playful sticker collage repeating the same golden retriever and red bandana.",
      "subject_zh": "同一只金毛与红领巾的波普贴纸拼贴。",
      "original_path": "/assets/ai-styles/pets-original.png",
      "style": "pet-pop-stickers",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/pet-pop-stickers.png",
      "sort_order": 25,
      "source_reference": "12.png",
      "results": [
        {
          "style_code": "pet-pop-stickers",
          "image_path": "/assets/ai-style-pack/pet-pop-stickers.png"
        }
      ]
    },
    {
      "code": "pets-oil-pastel-pet",
      "name": "Pastel best friend",
      "name_zh": "金毛伙伴 · 油画棒",
      "subject": "A single golden retriever rendered with soft oil-pastel strokes and paper grain.",
      "subject_zh": "用油画棒颗粒与柔软笔触描绘同一只金毛。",
      "original_path": "/assets/ai-styles/pets-original.png",
      "style": "oil-pastel-pet",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/oil-pastel-pet.png",
      "sort_order": 26,
      "source_reference": "13.png",
      "results": [
        {
          "style_code": "oil-pastel-pet",
          "image_path": "/assets/ai-style-pack/oil-pastel-pet.png"
        }
      ]
    },
    {
      "code": "couples-geometric-paper",
      "name": "Two by the sea",
      "name_zh": "海岸合照 · 几何剪纸",
      "subject": "A couple and the coast rebuilt from layered geometric paper shapes.",
      "subject_zh": "以层叠几何纸片重构情侣与海岸。",
      "original_path": "/assets/ai-styles/couples-original.png",
      "style": "geometric-paper",
      "phone_model_code": "model-3",
      "image_path": "/assets/ai-style-pack/geometric-paper.png",
      "sort_order": 27,
      "source_reference": "14.png",
      "results": [
        {
          "style_code": "geometric-paper",
          "image_path": "/assets/ai-style-pack/geometric-paper.png"
        }
      ]
    }
  ]
};
