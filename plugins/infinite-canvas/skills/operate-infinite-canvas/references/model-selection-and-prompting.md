# Infinite Canvas 模型选用与提示词指南

> Bundled reference for `operate-infinite-canvas`
>
> Last researched: 2026-07-30
>
> Scope: the 66 model endpoints seeded by the repository at the research date

## 1. 使用原则

本参考为当前模型提供：

- 模型选择决策流程；
- 各模型家族的优势、适用场景、限制和提示词规范；
- 图片与视频比例选择方法；
- 当前 66 个端点到模型家族的映射。

模型能力有三层事实源，优先级从高到低为：

1. 运行时 `get_canvas_model_catalog` 返回的 Provider、模型 ID、参数和可用状态；
2. 当前仓库 Provider schema；
3. 模型厂商或承载 Provider 的一手文档。

官网写了但运行时目录没有的模型或参数，不得擅自使用。社区内容可用于发现测试方向，
但版本漂移、样本筛选和不可复现问题较多，不作为本文的硬性能力承诺。

当前 66 个端点可归并为 19 个提示词家族。相同底层模型在不同 Provider 上共用内容规范，
但必须保留运行时返回的精确 Provider/model 配对，不能只按相似名称替换。

## 2. 目录与查找方式

- [模型选择决策流程](#4-模型选择决策流程)
- [图片模型家族指南](#5-图片模型家族指南)
- [视频模型家族指南](#6-视频模型家族指南)
- [音频模型指南](#7-音频模型指南)
- [比例选择指南](#8-比例选择指南)
- [66 个运行时模型端点覆盖表](#9-66-个运行时模型端点覆盖表)
- [执行前后检查表](#10-skill-执行前后检查表)

不要为每次任务从头读取全文。先在第 9 节搜索精确模型 ID，找到对应家族章节；模型尚未
确定时先读第 4 节，涉及画幅时再读第 8 节。

## 3. 强制模型规则

每次配置生成节点前：

1. 调用 `get_canvas_model_catalog`；
2. 判断节点模式、输入类型、参考素材、文字准确度、人物一致性、动作、音频、比例、时长、
   清晰度、速度和成本；
3. 选择同一 catalog 记录中的精确 Provider/model 配对；
4. 确认目标参数在该端点 schema 内；
5. 按对应模型家族组织提示词；
6. 非显然选择用一句话说明理由；
7. 用户明确指定的模型或规格不可用时说明原因，不静默替换。

多轮探索要区分草稿和定稿，不让所有试稿使用最高成本设置，也不在定稿阶段无理由使用
未知免费端点。不得凭模型名称猜测能力；私有端点仅使用 runtime schema 声明的能力。

比例决策依次遵循：用户明确规格 → 发布渠道 → 来源素材与主体几何 → 系列一致性 →
模型支持范围 → 最少裁切和自然留白。图片编辑、图生视频、首尾帧和转场默认保持来源比例，
优先使用 `auto`、`adaptive` 或来源画幅；不得无条件选择 `16:9`、`1:1` 或 `9:16`。

## 4. 模型选择决策流程

### 4.1 先选任务模式

| 任务 | 首选模型家族 |
|---|---|
| 高质量通用图片、文字排版、精细编辑 | GPT Image 2、Nano Banana Pro、Seedream 5 Pro |
| 快速图片试稿 | Nano Banana 2、Seedream 5 Lite、Z-Image Turbo |
| 海报、信息密集版式、多语言文字 | GPT Image 2、Seedream 5 Pro、Nano Banana Pro |
| 时尚、人像、编辑感图片 | Higgsfield Soul V2 |
| 多参考图合成或一致性编辑 | Nano Banana、Seedream、Wan Image Edit |
| LoRA 风格或角色控制 | Z-Image Turbo LoRA |
| 去背景、擦除、扩图 | 对应专用工具模型，不用通用生成模型替代 |
| 通用图生视频 | Grok Imagine Video、Seedance 2、Kling V3、Wan 2.7 |
| 多模态参考、复杂镜头、音画一体 | Seedance 2、Gemini Omni Flash |
| 强动作、VFX、分镜 | PixVerse C1、Kling V3、Seedance 2 |
| 人体动作复刻 | Kling Motion Control |
| 首尾帧/转场 | Seedance first-last、PixVerse transition、Wan 2.7 |
| 图片数字人 | PixVerse Avatar |
| 音乐视频 | PixVerse Vibe MV |
| TTS | ElevenLabs Eleven v3 |
| 歌曲生成 | Suno |

### 4.2 再选质量档

- **试稿阶段**：优先速度快、价格低、可快速改提示词的端点；分辨率先用中档。
- **定稿阶段**：优先文字准确、身份一致、动作稳定或可交付分辨率；只对已确认方向升档。
- **系列任务**：先确定一个基准模型、比例、种子或参考图策略，再批量扩展。
- **未知端点**：只用于低风险试验；没有官方映射时不能宣称其风格、质量或安全能力。

### 4.3 通用提示词骨架

**文生图：**

```text
[主体、数量、关键外观]，[动作或关系]；
[场景、时代、环境细节]；
[构图、景别、视角、镜头语言]；
[光线、色彩、材质]；
[风格或媒介]；
[必须出现的准确文字、字体气质与位置]；
[必须保留/不得出现的约束]；
[用途与目标比例]
```

**图片编辑：**

```text
更改：[只描述要改变的对象、区域和结果]。
保留：[人物身份、姿态、构图、光线、背景、文字等不可变项]。
输出：[目标用途、比例、清晰度]。
```

**文生视频：**

```text
镜头 1（0–Xs）：[主体与一个主要动作]，[场景]。
摄影机：[景别、机位、运动、速度]。
视觉：[光线、色彩、材质、运动质感]。
声音：[对白/环境声/音乐；不需要则明确无声]。
连续性约束：[身份、服装、道具、方向、不得切镜等]。
```

**图生视频：**

```text
[主体如何从输入帧开始运动]；
[环境中哪些元素运动，幅度与节奏]；
[摄影机运动]；
[需要保持不变的身份、构图、服装、文字或产品形状]；
[声音与时长节奏]
```

图生视频不要大段复述输入图的静态外观，重点描述“接下来发生什么”。

### 4.4 与现有 Skill 路由基线的兼容

本文扩展选择维度，但不应在落地时意外删除现有 `model-routing.md` 的明确基线：

| 场景 | 当前基线 | 落地建议 |
|---|---|---|
| 普通图片编辑 | fal.ai + `openai/gpt-image-2`，中等质量 | 保留为默认候选，再按文字、参考图和成本要求比较 |
| 合规请求疑似误判内容策略 | fal.ai + `fal-ai/bytedance/seedream/v5/pro` | 仅在请求本身允许时重试一次，不用于绕过真实限制 |
| 普通图生视频 | fal.ai (Img2Video) + `xai/grok-imagine-video/image-to-video` | 用户未指定时保留来源比例/`auto` |
| 多参考视频 | RunningHub (Seedance) + `bytedance/seedance-2.0/runninghub-multimodal` | 试稿 480p、定稿 720p；比例优先 `adaptive` |

这些是当前工作流默认值，不是永久质量排行榜。用户明确选择、实时 catalog、素材约束和
交付规格仍具有更高优先级。

## 5. 图片模型家族指南

### 5.1 GPT Image 2 / GPT Image 1.x

**端点：** `openai/gpt-image-2`、`gpt-image-2`、`fal-ai/gpt-image-1.5`、
`fal-ai/gpt-image-1`、`gpt-image-1.0`

**选用：**

- GPT Image 2 用于定稿级图片、准确文字、复杂约束和高保真编辑；
- GPT Image 1.5 用于需要兼容旧工作流但仍重视编辑与文字的任务；
- GPT Image 1 / 1.0 主要用于旧参数兼容或成本比较，不应无理由优先于新版本。

OpenAI 将 GPT Image 2 定位为最新的高质量图像生成/编辑模型，并强调输入图保真；
GPT Image 1.5 的官方发布说明强调更精确的编辑、细小文字和构图保持。
参见 [GPT Image 2 模型页](https://developers.openai.com/api/docs/models/gpt-image-2)、
[GPT Image 1.5 发布说明](https://openai.com/index/new-chatgpt-images-is-here/)。

**提示词规范：**

1. 按“场景 → 主体 → 关键细节 → 用途 → 约束”写清视觉事实；
2. 准确文字使用引号包裹，并写明位置、层级、字体气质和大小关系；
3. 编辑任务明确分为 `更改` 与 `保留`，不要只说“优化一下”；
4. 一轮只改一个主要问题，连续编辑时复用上一结果；
5. 避免“高级、好看、电影感”这类没有可视化依据的空泛形容词。

承载 Provider 的提示词指南也推荐按视觉事实分段，并在编辑时显式区分 change/preserve：
[fal GPT Image 2 Prompt Guide](https://fal.ai/learn/tools/prompting-gpt-image-2)。

**比例：** 文字密集海报先按交付版式选比例；图片编辑默认保持输入比例。不同 Provider
暴露的尺寸不同，必须以运行时 catalog 为准。

### 5.2 Nano Banana Pro / Nano Banana 2

**端点：** `fal-ai/nano-banana-pro`、`fal-ai/nano-banana-2`、
`nano-banana-pro`、`nano-banana-2`

**选用：**

- Nano Banana Pro：复杂专业构图、多参考图、品牌一致性、多语言文字、需要精确控制的定稿；
- Nano Banana 2：通用生成、快速迭代、世界知识辅助和成本/速度更敏感的任务。

Google 官方指南将 Nano Banana 2 描述为高效通用模型，将 Pro 面向复杂、专业和高精度
工作流。参见 [Gemini 图片生成指南](https://ai.google.dev/gemini-api/docs/image-generation)、
[Gemini 3 Pro Image 模型页](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image)。

**提示词规范：**

1. 使用自然语言完整描述意图，不堆关键词；
2. 按主体、场景、构图、光线、风格、文字、约束组织；
3. 多参考图逐一说明角色，例如“图 1 提供人物身份，图 2 提供服装，图 3 提供构图”；
4. 编辑时用“只改变 X；保持 Y/Z 完全不变”；
5. 品牌任务写出固定色值、标志位置、产品结构和禁止变形项；
6. 需要事实知识时仍应核对结果，不能把模型生成当作事实来源。

**比例：** 当前端点覆盖常用横、竖、方形及宽银幕比例。多图合成应先选主构图，再决定
输出比例；不要让比例由某张次要参考图偶然决定。

### 5.3 Seedream 4.5 / 5 Lite / 5 Pro

**端点：** `fal-ai/bytedance/seedream/v4.5`、
`fal-ai/bytedance/seedream/v5/lite`、`fal-ai/bytedance/seedream/v5/pro`

**选用：**

- 5 Pro：复杂提示词、文字密集设计、多语言版式、精确局部编辑和高要求定稿；
- 5 Lite：快速通用生成/编辑、多参考图试稿；
- 4.5：稳定的摄影、插画和设计工作流，适合已有 4.5 参数资产的兼容任务。

Seedream 5 Pro 的 Provider 文档强调复杂提示理解、原生多语言文字和密集布局；
5 Lite 强调自然语言、多参考和较快迭代。参见
[Seedream 5 Pro API](https://fal.ai/models/bytedance/seedream/v5/pro/text-to-image/api)、
[Seedream 5 Pro Edit](https://fal.ai/models/bytedance/seedream/v5/pro/edit)、
[Seedream 5 Lite 使用指南](https://fal.ai/learn/tools/how-to-use-seedream-5-lite)。

**提示词规范：**

1. 最重要的主体和动作放在最前；
2. 随后依次写风格、构图、光线和技术要求；
3. 4.5 可优先使用 30–100 个英文单词或等量中文信息，避免无限堆砌；
4. 5 Lite 用 2–4 个完整句子，明确对象之间的空间关系；
5. 编辑使用“改变 X，保留 Y”；需要局部编辑时指出区域和边界；
6. 参考图逐张编号并说明用途，不只写“参考这些图”。

参见 [Seedream 4.5 Prompt Guide](https://fal.ai/learn/devs/seedream-v4-5-prompt-guide)。

**比例：** 5 Pro 的当前仓库尺寸范围比 4.5/5 Lite 更受限；选择前必须检查 catalog。
自定义尺寸应先满足目标版式，再落入端点允许的宽高范围。

### 5.4 Grok Imagine Image

**端点：** `xai/grok-imagine-image`

**选用：** 通用创意视觉、宽比例探索和快速构图。若任务核心是非常精细的文字排版或
多参考精确编辑，应先与 GPT Image 2、Nano Banana Pro、Seedream 5 Pro 对比。

xAI 官方文档提供图片生成、编辑和多种宽高比能力。参见
[Grok Imagine Image 模型页](https://docs.x.ai/developers/models/grok-imagine-image)、
[图片生成能力说明](https://docs.x.ai/developers/model-capabilities/images/generation)。

**提示词规范：**

1. 主体和动作先写，随后是环境、构图、镜头、光线和风格；
2. 把抽象气氛转成可见细节，如天气、材质、色温、景深；
3. 多主体说明数量、相对位置和互动；
4. 文字任务写准确字符串并限制其他随机文字；
5. 一次只设置一个主视觉中心。

**比例：** 当前 schema 支持从竖屏到宽银幕的多种比例。只有内容或渠道确实需要时才使用
`2:1`、`20:9`、`21:9` 等极宽画幅。

### 5.5 Wan 2.7 Image Edit

**端点：** `alibaba/wan-2.7/image-edit-pro`、`alibaba/wan-2.7/image-edit`

**选用：**

- Pro：多参考、复杂合成、身份/材质保持和定稿编辑；
- Standard：方向探索和简单修改。

Provider 文档支持中英文提示、1–4 张参考图、负向提示和提示词扩展。参见
[Wan 2.7 Pro Edit](https://fal.ai/models/fal-ai/wan/v2.7/pro/edit/api)、
[Wan 2.7 Edit](https://fal.ai/models/fal-ai/wan/v2.7/edit)。

**提示词规范：**

1. 用“参考图 1/2/3”明确每张图的作用；
2. 先写最关键改动，再写风格和细节；
3. 单独列出必须保留的身份、构图、产品形状和文字；
4. 负向提示只写真正要排除的缺陷，不复制超长通用负面词表；
5. 开启 prompt expansion 后仍要检查是否引入用户未要求的元素。

**比例：** 编辑默认保持主图比例；若用于重新版式，明确哪张图决定画幅。

### 5.6 Higgsfield Soul V2

**端点：** `soul-v2-standard`

**选用：** 时尚、人像、生活方式、杂志编辑感、文化风格和 moodboard。它不是文字密集
信息图或工具型精确编辑的默认选择。

Higgsfield 官方将 Soul 面向具有时尚和文化审美的图像，并提供风格预设、参考图和不同
分辨率。参见 [Soul 介绍](https://higgsfield.ai/soul-intro)、
[AI Fashion Photo Guide](https://higgsfield.ai/blog/ai-fashion-photo-generator)。

**提示词规范：**

1. 开头写人物、服装和摄影方向；
2. 明确时代、文化语境、情绪和姿态；
3. 写镜头、光线、胶片/数码质感和编辑风格；
4. 使用风格预设时，提示词补充内容，不重复堆叠冲突风格；
5. 参考人像要说明保持身份还是只借鉴造型；
6. 试稿使用中档分辨率，定稿方向确认后再升档。

**比例：** 全身时装优先 `2:3`、`3:4` 或 `9:16`；杂志横跨页、环境人像再考虑横版；
头像和 moodboard 卡片可用 `1:1`。

### 5.7 Z-Image Turbo LoRA

**端点：** `fal-ai/z-image/turbo/lora`

**选用：** 需要 LoRA 角色、风格或产品控制的快速图片试验；不适合同时叠加许多相互冲突
的 LoRA。

Provider schema 支持最多 3 个 LoRA、较少采样步数、种子和自定义尺寸。参见
[Z-Image Turbo LoRA API](https://fal.ai/models/fal-ai/z-image/turbo/lora/api)、
[Z-Image Turbo Developer Guide](https://fal.ai/learn/devs/z-image-turbo-developer-guide)。

**提示词规范：**

1. 先写主体和场景，再准确加入 LoRA 要求的触发词；
2. 每个 LoRA 只承担一个清晰角色或风格目标；
3. 不用互相冲突的摄影、插画和材质描述；
4. 固定种子比较提示词或权重变化；
5. 少步数用于草稿，确认方向后再提高到端点允许的定稿步数。

### 5.8 专用图片工具

**端点：** `fal-ai/ideogram/remove-background`、`fal-ai/flux-pro/v1/erase`、
`flux-tools/outpainting-v1`

**选用与提示词：**

- **Remove Background**：没有创作提示词；输入前景边界清楚的图片，输出后检查头发、玻璃、
  半透明材质和 logo。保持原比例。参见
  [Ideogram Background Remover](https://ideogram.ai/features/background-remover/api)。
- **Erase**：核心输入是与原图同尺寸的 mask，白色擦除、黑色保留；必要时调 mask dilation，
  不用长提示词替代准确遮罩。参见
  [BFL Erase API](https://docs.bfl.ai/api-reference/models/erase-an-object-from-an-image)。
- **Outpainting**：提示词描述“画面边界之外应继续出现什么”，同时要求原图主体、光线、透视
  和材质连续；目标比例由扩展方向决定。参见
  [BFL Prompting Guide](https://docs.bfl.ai/guides/prompting_summary)。

### 5.9 私有/未公开映射的 Free 图片端点

**端点：** `cfivi2i`、`cfikli2i`、`ggnnp`

公开资料无法可靠对应这些内部 ID 的底层模型，因此不能为它们编造厂商优势。

- `cfivi2i` / `cfikli2i`：按当前 schema 只确认需要图片、支持参考图、提供
  `general`、`single_fix`、`double`、`double_fix` 子模式，不支持尺寸选择；
- `ggnnp`：按当前 schema 只确认需要图片、支持参考图、提供常见比例与 `1K/1.5K`。

**提示词规范：** 使用最保守的图片编辑格式：“改变什么、保留什么、参考图角色、禁止新增
什么”。只用于可人工复核的试稿。没有模型方资料前，不把它们写成某种风格、质量或安全
能力的推荐模型。

## 6. 视频模型家族指南

### 6.1 Seedance 2.0

**端点：** `bytedance/seedance-2`、`dreamina-seedance-2-0-260128`、
`bytedance/seedance-2.0/reference-to-video`、
`bytedance/seedance-2.0/runninghub-multimodal`、
`bytedance/seedance-2.0/runninghub-cn-multimodal`、
`bytedance/seedance-2.0-fast/runninghub-multimodal`、
`bytedance/seedance-2.0-mini/runninghub-multimodal`、
`bytedance/seedance-2.0/runninghub-text-to-video`、
`bytedance/seedance-2.0/runninghub-image-to-video`、
`bytedance/seedance-2.0/runninghub-first-last-frame`

**选用：**

- 多模态参考、复杂镜头、角色/场景/动作组合和原生音频；
- `fast` / `mini` 用于试稿，标准端点用于定稿；
- first-last-frame 用于明确的首尾过渡；
- KIE、TokenSpace、fal、RunningHub 是不同执行路径，不得按名称静默互换。

ByteDance 官方强调多模态联合创作和音视频生成；Provider 指南建议把提示词写成摄影简报。
参见 [Seedance 2.0 官方发布](https://seed.bytedance.com/blog/seedance-2-0-official-launch)、
[Seedance 2.0 使用指南](https://fal.ai/learn/tools/how-to-use-seedance-2-0)、
[Text-to-Video API](https://fal.ai/docs/model-api-reference/video-generation-api/bytedance-seedance-2.0-text-to-video)。

**提示词规范：**

1. 每个镜头只设一个主要动作和一个主要摄影机运动；
2. 多镜头按 `Shot 1/2/3` 或时间段分段；
3. 依次写主体动作、摄影机、场景运动、光线、声音、转场；
4. 参考素材逐一指定用途，不让模型猜哪张图控制人物或场景；
5. 需要单镜头时明确“单一连续镜头、无切镜”；
6. 首尾帧任务描述从 A 到 B 的运动路径，不重复描述已可见的静态内容。

**比例：** 无明确目标时，图生视频用 `adaptive` 或来源比例；文生视频按渠道选择。
同一成片各镜头保持统一比例。

### 6.2 Gemini Omni Flash

**端点：** `google/gemini-omni-flash/reference-to-video`

**选用：** 混合图片、视频和音频参考的多模态视频，或需要对参考素材进行对话式迭代的
场景。当前属于 preview 能力，定稿前应额外做稳定性复核。

Google 官方指南说明该模型支持原生多模态输入、声音和视频生成，并提醒默认可能产生多镜头；
需要连续镜头时应明确禁止切镜。参见
[Gemini Omni 指南](https://ai.google.dev/gemini-api/docs/omni)、
[Gemini Omni Flash 模型页](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash?hl=en)。

**提示词规范：**

1. 写明每个输入素材的角色；
2. 使用“场景、摄影机、光线、情绪、声音、时间”的完整结构；
3. 对需要保持的身份、产品形状、文字和服装显式加约束；
4. 高质量参考素材优先；
5. 单镜头写 `single continuous unbroken shot, no cuts` 或等义中文；
6. 不把 preview 模型的偶然输出当成稳定能力。

### 6.3 Grok Imagine Video

**端点：** `xai/grok-imagine-video/v1.5/image-to-video`、
`xai/grok-imagine-video/image-to-video`、
`xai/grok-imagine-video/text-to-video`

**选用：** 通用快速图生视频或文生视频；现有 Skill 路由将
`xai/grok-imagine-video/image-to-video` 作为普通图生视频默认候选。V1.5 可在目录可用时
作为新版本对照，但不能仅凭版本号假设所有参数兼容。

参见 [Grok Imagine Video API](https://fal.ai/docs/model-api-reference/video-generation-api/xai-grok-imagine-video)、
[Grok Imagine Video 1.5](https://fal.ai/models/xai/grok-imagine-video/v1.5/image-to-video/api)。

**提示词规范：**

1. 主体动作必须具体，例如“转头看向镜头并迈出两步”；
2. 摄影机只写一个主要运动，避免同时推、拉、摇、绕；
3. 补充环境运动、光线变化、视觉质感和声音；
4. 图生视频明确必须保持的脸、服装、产品几何和文字；
5. 需要无切镜、无形变、无新增人物时直接写出。

**比例：** 用户未指定时优先 `auto`/来源比例；只有渠道要求明确时覆盖。

### 6.4 Kling Video V3 / V2.6 Motion Control

**端点：** `fal-ai/kling-video/v3/standard/text-to-video`、
`fal-ai/kling-video/v3/pro/text-to-video`、
`fal-ai/kling-video/v3/4k/text-to-video`、
`fal-ai/kling-video/v3/standard/image-to-video`、
`fal-ai/kling-video/v3/pro/image-to-video`、
`fal-ai/kling-video/v3/4k/image-to-video`、
`fal-ai/kling-video/v3/standard/motion-control`、
`fal-ai/kling-video/v3/pro/motion-control`、
`fal-ai/kling-video/v2.6/standard/motion-control`、
`fal-ai/kling-video/v2.6/pro/motion-control`

**选用：**

- Standard：试稿和批量探索；
- Pro：身份、运动和画质更重要的定稿；
- 4K：方向已经确认且交付确实需要高分辨率；
- Motion Control：用人物图加动作参考视频复刻人体运动，不是普通图生视频替代品；
- V2.6 主要用于兼容或与 V3 结果对照。

Motion Control 文档要求主体图身体清晰，并区分参考视频方向和参考图片方向的控制方式。
参见 [Kling V3 Standard](https://fal.ai/docs/model-api-reference/video-generation-api/kling-video-v3-standard)、
[Kling V3 Pro Motion Control](https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control/api)、
[Kling V3 4K](https://fal.ai/models/fal-ai/kling-video/v3/4k/text-to-video/api)。

**提示词规范：**

1. 通用视频使用“主体、动作、环境、摄影机、光线、声音”；
2. 多镜头分段，不在一个句子里堆叠不可能同时发生的动作；
3. Motion Control 的文字只补充场景、镜头和保持项，主要动作来自参考视频；
4. 动作参考要全身清楚、遮挡少，人物图与动作幅度相容；
5. 定稿升到 Pro/4K 前先用同构提示词完成标准档验证。

**比例：** 文生视频按当前 schema 在 `16:9`、`9:16`、`1:1` 中选择；图生视频和
Motion Control 优先保持输入画幅。

### 6.5 Wan 2.7 Video

**端点：** `alibaba/wan-2.7/reference-to-video`、
`alibaba/wan-2.7/image-to-video`、`alibaba/wan2.7-i2v-spicy`

**选用：** 强调运动连贯、物理合理性、首尾过渡或参考视频的任务；Standard/不同 Provider
用于成本、速度和可用性比较，不得假定参数完全相同。

Provider 文档描述 Wan 2.7 的图生视频、参考和首尾能力，支持 720p/1080p 与 2–15 秒范围。
参见 [Wan 2.7 概览](https://fal.ai/wan-2.7)、
[Wan 2.7 Image-to-Video](https://fal.ai/models/fal-ai/wan/v2.7/image-to-video)。

**提示词规范：**

1. 关键动作和约束放在开头；
2. 描述动作的起点、过程、终点和速度；
3. 多镜头使用时间段，写清方向连续性；
4. 产品、人物或道具必须列出保持项；
5. 图生视频优先描述运动，不重复静态画面；
6. `spicy` 只是当前端点 ID 的一部分，没有公开证据时不解释成内容或风格承诺。

**比例：** 当前图生视频端点未统一暴露比例时，以输入图片比例为准。

### 6.6 PixVerse V6 / C1 / Effect / Avatar / Vibe MV

**端点：** `pixverse/v6/reference-to-video`、`pixverse/v6/text-to-video`、
`pixverse/c1/text-to-video`、`pixverse/v6/image-to-video`、
`pixverse/c1/image-to-video`、`pixverse/v6/transition`、
`pixverse/c1/transition`、`pixverse/effect`、`pixverse/avatar`、
`pixverse/vibe-mv`

**选用：**

- V6：通用文生/图生/参考视频和较长时长；
- C1：动作、VFX、分镜和电影制作探索；
- transition：明确首尾帧过渡；
- effect：调用固定特效模板，模板和输入素材比自由提示词更重要；
- avatar：单张人像加音频/音色的数字人；
- Vibe MV：已有音频的音乐视频，可选角色图、歌词、风格、口型和字幕。

官方 V6 文档列出 1–15 秒、多档分辨率和常见比例；C1 官方材料将其面向动作、VFX 和
故事板。参见 [PixVerse V6 Docs](https://docs.platform.pixverse.ai/v6-released-2056814m0)、
[PixVerse C1](https://pixverse.ai/en/blog/pixverse-c1-cinematic-ai-video-model-review)、
[Avatar Docs](https://docs.platform.pixverse.ai/avatar-2266777m0)。

**提示词规范：**

1. V6/C1 使用身份、动作、环境、摄影机、光线、声音、约束的固定顺序；
2. 系列角色复用完全相同的 identity block 和参考图；
3. C1 把动作拆成清晰节拍，不要在短时长中塞入完整长剧情；
4. transition 描述首尾之间的变化路径和摄影机连续性；
5. effect 选择精确模板并满足素材数量，不编造模板不存在的控制项；
6. avatar 的文字描述表情、姿态和动作幅度；音频内容本身决定口播；
7. Vibe MV 写音乐风格、MV 视觉风格、段落情绪和歌词；纯音乐关闭口型同步，有歌词且需
   演唱表现时再开启口型，字幕按交付需求选择。

PixVerse 的一致性指南建议固定身份描述、词序和参考素材：
[Consistent Characters Guide](https://pixverse.ai/en/blog/how-to-create-consistent-characters-with-ai)。

**比例：**

- 文生视频按渠道选择；
- 图生、参考和 transition 优先继承来源；
- Avatar 通常用 `9:16` 或 `1:1`，视发布槽位决定；
- Vibe MV 横版歌曲视频用 `16:9`，竖屏音乐内容用 `9:16`，封面式循环视觉可用 `1:1`。

### 6.7 MiniMax Hailuo 2.3 / 02

**端点：** `MiniMax-Hailuo-2.3`、`MiniMax-Hailuo-2.3-Fast`、
`MiniMax-Hailuo-02`

**选用：**

- 2.3：人体动作、微表情、物体运动和风格化图生视频定稿；
- 2.3 Fast：快速试稿；
- 02：旧工作流兼容、较低分辨率或结果对照。

MiniMax 官方发布说明强调 2.3 的身体动作、微表情和物体运动改进；API 提供摄影机命令。
参见 [Hailuo 2.3 发布说明](https://www.minimax.io/news/minimax-hailuo-23)、
[Image-to-Video API](https://platform.minimax.io/docs/api-reference/video-generation-i2v)、
[Hailuo 02](https://www.minimax.io/news/minimax-hailuo-02)。

**提示词规范：**

1. 描述输入帧之后发生的一项主要动作；
2. 摄影机命令使用 API 规定的方括号语法；
3. 同时摄影机命令不超过 3 个，连续动作按顺序排列；
4. 明确保持人物身份、服装和构图；
5. prompt optimizer 开启后检查是否改变原意；
6. Fast 验证动作方向，Standard 完成最终质量。

**比例：** 图生视频保持来源比例；分辨率和时长以各端点 schema 为准。

### 6.8 私有/未公开映射的 Free Video

**端点：** `atcfi`

当前 schema 只确认：需要图片、比例 `auto`、分辨率 `720p`、时长 5 秒。没有可靠公开
资料证明其底层模型，因此只用于可人工复核的低风险试稿。

**提示词规范：** 使用简短图生视频结构：一个主体动作、一个摄影机运动、一个保持约束。
不要宣称它支持音频、多镜头、身份锁定或其他 schema 未声明的能力。

## 7. 音频模型指南

### 7.1 ElevenLabs Eleven v3 TTS

**端点：** `fal-ai/elevenlabs/tts/eleven-v3`

**选用：** 旁白、对白、角色语音和带情绪控制的文本转语音。

ElevenLabs 官方建议优先选择与目标相符的 voice，使用自然文本、标点和 audio tags 控制
表达；标签效果取决于声音本身。参见
[ElevenLabs Prompting](https://elevenlabs.io/docs/best-practices/prompting)、
[TTS Best Practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)。

**提示词/文本规范：**

1. 先选与语言、年龄、情绪和角色匹配的声音；
2. 用完整自然句和合理标点控制停顿；
3. 需要时使用模型支持的 `[whispers]`、`[laughs]` 等 audio tags；
4. 标签必须与 voice 的自然表现范围相符；
5. 较长文本按语义段落拆分，但保留上下文连续性；
6. 品牌读音、人名、数字和缩写先做小样验证；
7. 不把“提示词”写成画面描述，实际输入应是要朗读的文本与表演标记。

### 7.2 Suno Music

**端点：** `suno/ai-music`

**选用：** 完整歌曲、器乐、配乐和带歌词的音乐。当前应用子模型包含 V4、V4.5 系列、
V5、V5.5；使用时必须以 catalog 实际返回为准。

Suno 官方将 V5.5 描述为更丰富的编曲和更清晰的演唱，并保留 V5 等版本供不同工作流
使用。参见 [Suno v5.5](https://help.suno.com/en/articles/8105153)、
[模型版本说明](https://help.suno.com/en/articles/5782721)。

**提示词规范：**

1. 风格栏写：流派/子流派、情绪、速度或 BPM、调性（确定时）、配器、主唱类型与语言、
   年代/制作质感、歌曲结构；
2. 歌词栏只放歌词，用 `[Verse]`、`[Pre-Chorus]`、`[Chorus]`、`[Bridge]` 等段落标签；
3. 不把歌词混进风格描述，也不把制作参数塞进歌词；
4. 纯音乐明确 `instrumental`，不要提供会被误唱的歌词文本；
5. 使用 Exclude 排除不需要的乐器或风格，不在主提示词里反复否定；
6. 一次先确定风格与结构，再微调歌词和混音，不同时大改全部变量。

参见 [Suno Exclude Styles](https://help.suno.com/en/articles/3161921)。

## 8. 比例选择指南

### 8.1 渠道与常用比例

| 比例 | 典型用途 | 构图提醒 |
|---|---|---|
| `9:16` | 短视频、Story、竖屏广告、全屏数字人 | 主体纵向排列；重要文字避开上下 UI 安全区 |
| `4:5` | 移动端信息流海报、人像产品图 | 比 `9:16` 更适合静态 feed；兼顾主体和说明文字 |
| `3:4` / `2:3` | 海报、杂志人像、全身时装 | 为人物和标题留纵向空间 |
| `1:1` | 头像、封面、方形卡片、多平台通用预览 | 中心构图，避免横向叙事过多 |
| `4:3` / `3:2` | 摄影、演示图、传统屏幕、环境人像 | 适合主体与环境并重 |
| `16:9` | 横屏视频、网页横幅、演示、YouTube | 横向调度主体；不要把竖图硬裁成横版 |
| `21:9` | 电影宽银幕、极宽品牌横幅 | 只有场景和叙事需要时使用；移动端利用率低 |

平台的安全区和发布规格会变化，实际交付前应以目标平台当期规范为准。

### 8.2 内容几何判断

- 单人半身、产品正面、对称图标：`1:1`、`4:5`；
- 全身人物、建筑立面、竖向包装：`2:3`、`3:4`、`9:16`；
- 多人横向关系、风景、车辆侧面、室内空间：`3:2`、`4:3`、`16:9`；
- 对话、横向移动、电影场景：`16:9`，确有宽银幕语言时才用 `21:9`；
- 长标题加主体：先按版式槽位选择，不要生成后再强裁；
- 需要从图片做视频：先检查输入图是否为最终成片比例，必要时先扩图再生成视频。

### 8.3 比例冲突处理

1. 用户规格与来源素材冲突：说明会裁切或扩图，优先询问/采用显式交付规格；
2. 目标比例模型不支持：选择最接近比例，并在生成前说明；不能传未支持值；
3. 多参考图比例不同：指定主构图参考，其余只提供身份、服装或风格；
4. 首尾帧比例不同：先统一画幅和构图，再做 transition；
5. 系列镜头比例不同：除非用户明确需要混合画幅，否则先标准化；
6. `auto/adaptive`：只代表模型根据输入/默认推断，不代表无需思考。使用时仍要说明为何
   来源画幅适合交付。

## 9. 66 个运行时模型端点覆盖表

表中“规范”指向本文对应家族；“比例策略”是默认决策，不替代运行时 catalog。

| # | Provider | 模型 ID | 规范 | 默认比例策略 |
|---:|---|---|---|---|
| 1 | fal.ai | `fal-ai/nano-banana-pro` | 5.2 | 按交付；编辑保源 |
| 2 | fal.ai | `fal-ai/nano-banana-2` | 5.2 | 按交付；编辑保源 |
| 3 | fal.ai | `fal-ai/bytedance/seedream/v4.5` | 5.3 | 按交付或自定义尺寸 |
| 4 | fal.ai | `fal-ai/bytedance/seedream/v5/lite` | 5.3 | 按交付或自定义尺寸 |
| 5 | fal.ai | `fal-ai/bytedance/seedream/v5/pro` | 5.3 | 先查较窄尺寸范围 |
| 6 | fal.ai | `xai/grok-imagine-image` | 5.4 | 按内容几何 |
| 7 | fal.ai | `fal-ai/gpt-image-1.5` | 5.1 | 按端点固定尺寸 |
| 8 | fal.ai | `fal-ai/gpt-image-1` | 5.1 | 按端点固定尺寸 |
| 9 | fal.ai | `openai/gpt-image-2` | 5.1 | 按交付；编辑保源 |
| 10 | fal.ai | `fal-ai/z-image/turbo/lora` | 5.7 | 按交付或自定义尺寸 |
| 11 | fal.ai | `fal-ai/ideogram/remove-background` | 5.8 | 保持输入比例 |
| 12 | fal.ai | `fal-ai/flux-pro/v1/erase` | 5.8 | 保持输入和 mask 比例 |
| 13 | fal.ai Video | `fal-ai/kling-video/v3/standard/motion-control` | 6.4 | 保持人物图/动作参考 |
| 14 | fal.ai Video | `fal-ai/kling-video/v3/pro/motion-control` | 6.4 | 保持人物图/动作参考 |
| 15 | fal.ai Video | `fal-ai/kling-video/v2.6/standard/motion-control` | 6.4 | 保持人物图/动作参考 |
| 16 | fal.ai Video | `fal-ai/kling-video/v2.6/pro/motion-control` | 6.4 | 保持人物图/动作参考 |
| 17 | KIE AI | `nano-banana-pro` | 5.2 | 按交付；编辑保源 |
| 18 | KIE AI | `nano-banana-2` | 5.2 | 按交付；编辑保源 |
| 19 | KIE AI | `gpt-image-2` | 5.1 | 按交付；编辑保源 |
| 20 | KIE AI | `gpt-image-1.0` | 5.1 | 兼容旧工作流 |
| 21 | KIE AI (Seedance) | `bytedance/seedance-2` | 6.1 | 文生按渠道；多模态按主参考 |
| 22 | TokenSpace | `dreamina-seedance-2-0-260128` | 6.1 | `adaptive` 优先或按渠道 |
| 23 | fal.ai Audio | `fal-ai/elevenlabs/tts/eleven-v3` | 7.1 | 不适用 |
| 24 | KIE AI (Suno) | `suno/ai-music` | 7.2 | 不适用 |
| 25 | fal.ai (Seedance) | `bytedance/seedance-2.0/reference-to-video` | 6.1 | 以主参考/成片为准 |
| 26 | fal.ai (Seedance) | `google/gemini-omni-flash/reference-to-video` | 6.2 | 以主参考/成片为准 |
| 27 | RunningHub (Seedance) | `bytedance/seedance-2.0/runninghub-multimodal` | 6.1 | `adaptive` 优先 |
| 28 | RunningHub (Seedance) | `bytedance/seedance-2.0/runninghub-cn-multimodal` | 6.1 | `adaptive` 优先 |
| 29 | RunningHub (Seedance) | `bytedance/seedance-2.0-fast/runninghub-multimodal` | 6.1 | `adaptive` 优先 |
| 30 | RunningHub (Seedance) | `bytedance/seedance-2.0-mini/runninghub-multimodal` | 6.1 | `adaptive` 优先 |
| 31 | RunningHub (Seedance) | `alibaba/wan-2.7/reference-to-video` | 6.5 | 以主参考/成片为准 |
| 32 | PixVerse (Seedance) | `pixverse/v6/reference-to-video` | 6.6 | 以主参考/成片为准 |
| 33 | RunningHub (Image) | `alibaba/wan-2.7/image-edit-pro` | 5.5 | 保持主图比例 |
| 34 | RunningHub (Image) | `alibaba/wan-2.7/image-edit` | 5.5 | 保持主图比例 |
| 35 | Higgsfield | `soul-v2-standard` | 5.6 | 按时尚版式 |
| 36 | fal.ai (Img2Video) | `xai/grok-imagine-video/v1.5/image-to-video` | 6.3 | `auto`/来源比例 |
| 37 | fal.ai (Img2Video) | `xai/grok-imagine-video/image-to-video` | 6.3 | `auto`/来源比例 |
| 38 | fal.ai (Img2Video) | `fal-ai/kling-video/v3/standard/image-to-video` | 6.4 | 来源比例 |
| 39 | fal.ai (Img2Video) | `fal-ai/kling-video/v3/pro/image-to-video` | 6.4 | 来源比例 |
| 40 | fal.ai (Img2Video) | `fal-ai/kling-video/v3/4k/image-to-video` | 6.4 | 来源比例 |
| 41 | fal.ai (Text2Video) | `xai/grok-imagine-video/text-to-video` | 6.3 | 按渠道 |
| 42 | fal.ai (Text2Video) | `fal-ai/kling-video/v3/standard/text-to-video` | 6.4 | `16:9/9:16/1:1` 按渠道 |
| 43 | fal.ai (Text2Video) | `fal-ai/kling-video/v3/pro/text-to-video` | 6.4 | `16:9/9:16/1:1` 按渠道 |
| 44 | fal.ai (Text2Video) | `fal-ai/kling-video/v3/4k/text-to-video` | 6.4 | `16:9/9:16/1:1` 按渠道 |
| 45 | RunningHub (Text2Video) | `bytedance/seedance-2.0/runninghub-text-to-video` | 6.1 | 按渠道；可用 `adaptive` |
| 46 | PixVerse (Text2Video) | `pixverse/v6/text-to-video` | 6.6 | 按渠道 |
| 47 | PixVerse (Text2Video) | `pixverse/c1/text-to-video` | 6.6 | 按渠道 |
| 48 | PixVerse (Img2Video) | `pixverse/v6/image-to-video` | 6.6 | 来源比例 |
| 49 | PixVerse (Img2Video) | `pixverse/c1/image-to-video` | 6.6 | 来源比例 |
| 50 | PixVerse (Img2Video) | `pixverse/v6/transition` | 6.6 | 首尾帧先统一比例 |
| 51 | PixVerse (Img2Video) | `pixverse/c1/transition` | 6.6 | 首尾帧先统一比例 |
| 52 | PixVerse (Effect) | `pixverse/effect` | 6.6 | 按模板/来源 |
| 53 | PixVerse (Avatar) | `pixverse/avatar` | 6.6 | 按渠道，常用 `9:16/1:1` |
| 54 | PixVerse (Vibe MV) | `pixverse/vibe-mv` | 6.6 | `16:9/9:16/1:1` 按渠道 |
| 55 | RunningHub (Img2Video) | `alibaba/wan-2.7/image-to-video` | 6.5 | 来源比例 |
| 56 | RunningHub (Img2Video) | `bytedance/seedance-2.0/runninghub-image-to-video` | 6.1 | `adaptive`/来源比例 |
| 57 | RunningHub (Img2Video) | `bytedance/seedance-2.0/runninghub-first-last-frame` | 6.1 | 首尾帧先统一比例 |
| 58 | 阿里云 (Img2Video) | `alibaba/wan2.7-i2v-spicy` | 6.5 | 来源比例 |
| 59 | MiniMax (Img2Video) | `MiniMax-Hailuo-2.3` | 6.7 | 来源比例 |
| 60 | MiniMax (Img2Video) | `MiniMax-Hailuo-2.3-Fast` | 6.7 | 来源比例 |
| 61 | MiniMax (Img2Video) | `MiniMax-Hailuo-02` | 6.7 | 来源比例 |
| 62 | BFL | `flux-tools/outpainting-v1` | 5.8 | 由扩展方向决定 |
| 63 | Free | `cfivi2i` | 5.9 | schema 不支持选择尺寸 |
| 64 | Free | `cfikli2i` | 5.9 | schema 不支持选择尺寸 |
| 65 | Free | `ggnnp` | 5.9 | 按交付，先查 catalog |
| 66 | Free Video | `atcfi` | 6.8 | `auto`/来源比例 |

## 10. Skill 执行前后检查表

### 执行前

- [ ] 已读取实时模型 catalog；
- [ ] 已识别任务模式、交付渠道、目标比例、时长和分辨率；
- [ ] 已检查参考素材数量、类型、比例和清晰度；
- [ ] 已选定精确 Provider/model，而不是只写模型昵称；
- [ ] 已按对应模型家族重写提示词；
- [ ] 已评估草稿/定稿档位。

### 执行后

- [ ] 所需节点已达到成功或用户认可的终态；
- [ ] 实际执行的 Provider/model 与 catalog 中同一条记录一致；
- [ ] 比例、分辨率、时长和素材数量都在端点 schema 内；
- [ ] 输出画幅符合交付渠道，并且没有无理由裁切来源素材；
- [ ] 模型失败、拒绝或权限问题没有被静默换模型掩盖。

## 11. 维护规则

当 Provider seed、前端 schema 或模型目录发生变化时：

1. 重新比对第 9 节端点覆盖表；
2. 更新受影响家族的能力、参数和提示词规范；
3. 优先引用模型厂商或承载 Provider 的一手文档；
4. 更新顶部调研日期；
5. 不把社区个案升级成硬性能力承诺；
6. 保持 `model-routing.md` 的短路由表与本指南一致。
