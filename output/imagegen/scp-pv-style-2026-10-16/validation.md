# SCP 生图样例验收

生成方式：内置 ImageGen。每张图使用 `services/ai/promptUtils.ts` 对内容描述拼接得到的完整字符串，并输入对应类别的项目风格参考图。`prompts.json` 记录完整提示词、参考图、输出文件及校验值。

| 样图 | 画面检查 | 结果 |
| --- | --- | --- |
| SCP-049 背景 | 空置访谈室、两把椅子、医疗包、状态灯；平面色块、玻璃斜向图形、细排线可辨认 | 通过 |
| SCP-049 肖像 | 喙状面具、黑色兜帽与长袍、医疗包；衣褶按平面剪影组织，明暗分块清楚 | 通过 |
| SCP-3008 背景 | 重复家具展区、床垫与衣柜屏障、远处货架、空旷通道；木色、米色与局部灯光符合场景描述 | 通过 |
| SCP-3008-2 肖像 | 面部没有五官，脖颈比例异常，黄色上衣与蓝色裤装可辨认；平面造型和排线保持一致 | 通过 |

共用画法：轻薄的二维剪纸造型、细轮廓、分块明暗、平行排线与分层插画空间。画面颜色由题材材质和现场光源决定。

## 项目输入检查

通过运行中的本地后端连接本地模拟模型接口，检查 SDK 实际发出的请求：

| 路径 | 完整提示词 | 参考图片数据 |
| --- | --- | --- |
| Gemini `generateContent` | 与拼接函数输出逐字一致 | `inlineData` 图片字节与项目资源一致 |
| GPT Image `images/edits` | 与拼接函数输出逐字一致 | multipart 图片字节与项目资源一致 |

四个生图类别均显式选择对应参考图，资源校验值与 `assets/imageStyles/manifest.json` 一致。上述链路检查使用本地模拟接口，不调用模型或用户的出图端点。

原作设定来源：[SCP-049](https://scp-wiki.wikidot.com/scp-049)（Gabriel Jade；改写：djkaktus 与 Gabriel Jade）、[SCP-3008](https://scp-wiki.wikidot.com/scp-3008)（Mortos）。SCP 衍生图片采用 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 许可。
