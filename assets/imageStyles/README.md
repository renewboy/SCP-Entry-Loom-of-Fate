# 生图风格参考

图片提供轻薄平面剪纸造型、细轮廓、分块明暗、平行排线和分层插画空间。场景内容、人物身份、材质颜色及光源由生图提示词指定。

| 生图类别 | 参考图 |
| --- | --- |
| 背景 | `background.webp` |
| SCP 实体 | `entity.webp` |
| NPC 肖像 | `npc.webp` |
| 剧情场景 | `scene.webp` |

系统设置的“视觉设置”提供“默认（原版）”和“剪纸叙事”两种绘画风格，默认使用原版写实摄影风格。

`services/aiService.ts` 读取当前风格并拼接对应提示词。选择“剪纸叙事”时，根据类别加载一张参考图，将图片数据与提示词一起传给图片供应商；“默认（原版）”仅传递原版提示词。资源随应用打包，按生图需求加载。`manifest.json` 记录参考图生成提示词、资源尺寸和文件校验值。

风格观察来源：[原神剧情 PV「往日」](https://www.bilibili.com/video/BV1F8aJ6TEKz/)、[原神剧情 PV「燕归来」](https://www.bilibili.com/video/BV1cQap6UEr2/)。参考图由内置 ImageGen 根据用户提供的 PV 截图生成。

场景创作基于 [SCP-049](https://scp-wiki.wikidot.com/scp-049)（Gabriel Jade，改写：djkaktus 与 Gabriel Jade）和 [SCP-3008](https://scp-wiki.wikidot.com/scp-3008)（Mortos）。SCP 衍生图片采用 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 许可。NPC 人物为本项目创作。
