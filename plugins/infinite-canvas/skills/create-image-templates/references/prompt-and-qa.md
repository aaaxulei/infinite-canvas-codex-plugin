# Prompt patterns and visual QA

Use this reference when writing model prompts, reverse-engineering effect prompts,
or reviewing paid and free outputs.

## Contents

- Model temperament inference
- Model portrait prompt pattern
- Reusable effect prompt contract
- Paid-model choice
- Reference comparison and V2 decision
- Visual QA checklist

## Model temperament inference

Infer a short talent brief before writing the Soul prompt:

- **Role in the image**: observer, host, traveler, fashion subject, romantic lead,
  quiet protagonist, energetic participant, or another reference-supported role.
- **Temperament**: relaxed, warm, reserved, playful, confident, contemplative,
  adventurous, elegant, cool, or another visible quality.
- **Styling level**: everyday casual, refined lifestyle, occasion wear, editorial,
  outdoor, traditional, or minimal.
- **Expression and body language**: candid smile, calm gaze, gentle look-back,
  poised stillness, spontaneous movement, or another scene-compatible behavior.
- **Everyday context**: café, street, home, festival, coast, nature, studio-like
  wall, or another understated setting.

Choose a believable non-celebrity who could naturally inhabit the reference scene.
Retain a high-attractiveness Instagram/TikTok fashion-blogger aesthetic and
confident creator appeal. Favor a relaxed personal social-post presence, ordinary
surroundings, and believable imperfections from casual phone capture.

## Soul node settings

Resolve `soul-v2-standard` and all parameter values from the live catalog. Set and
persist these values explicitly before every Soul run:

- aspect ratio: `1:1`;
- quality/resolution: `720p`;
- style: the catalog option named `General`;
- prompt enhancement/expansion: off (`soulEnhancePrompt: false`);
- batch size: `1`, unless the user explicitly requests multiple candidates.

Do not convert an accepted Soul result into a durable private user asset. Connect
the Soul generation node's result directly to downstream editing nodes. Temporary
result expiry is handled by rerunning the unchanged prompt, seed, and settings, not
by uploading or persisting its output.

## Model portrait prompt pattern

Adapt region, explicit gender, inferred temperament, clothing, expression, body
language, and environment to the source document. Write the Soul prompt entirely
in Chinese. Use only positive descriptions of what should appear. Do not add a
negative prompt, an exclusion list, or prohibition wording. Keep the overall
target stable:

```text
一张 1:1 的生活化手机随拍照片，成年[地区和明确要求的性别]，真实的
Instagram/TikTok 高颜值时尚博主气质，[根据参考图推断的气质]，具有可信的素人身份，
[适合场景的穿搭、表情、身体语言和构图]，状态自然松弛，像朋友在日常生活中用手机
随手记录，自然环境光，普通而真实的生活场景，手机自动曝光形成自然的明暗变化，
轻微手持感和手机镜头透视，色彩接近手机直出，保留真实皮肤纹理、细腻毛孔和生活化
细节，脸部轮廓与主要五官清楚可辨，清晰度足够用于后续人物身份参考，画面亲近、
随意、可信，像博主发布在个人动态中的日常照片。
```

Avoid metadata labels such as “region:”, “model:”, or “requirements:” inside the
generation prompt. They can encourage unwanted layouts or text.

Use the following as a quality-and-detail example, adapting region, gender,
wardrobe, pose, props, and setting to the actual reference rather than copying
those identity traits into every template:

```text
成年女性，欧美高颜值 Instagram/TikTok 时尚博主气质，金色长发自然微卷并侧分，
干净自然的日常淡妆，真实皮肤纹理和细腻毛孔，身材高挑纤细，穿白色修身吊带上衣
与高腰白色短裤，肩背棕色托特包，手持手机与细线耳机，站在城市林荫大道的人行道
上，正面自然看向镜头，全身入镜，姿态松弛，像朋友散步时顺手用手机记录。道路两侧
的高大树木形成绿色树冠，路边停着汽车，远处是普通住宅和公寓街区，夏日下午的自然
光从树叶缝隙落下，人物和路面有自然斑驳光影，手机自动曝光带来轻微明暗变化和局部
高光，平视角度，轻微手机广角透视，背景保留真实街道细节，色彩接近手机直出，带有
轻微手持感和生活抓拍的自然随机感，脸部轮廓与主要五官清楚可辨，整体像她刚发布在个人
动态中的日常穿搭照片，亲近、自然、有生活气息。
```

## Reusable effect prompt contract

Write concrete visual facts rather than abstract praise.

```text
CHANGE: [scene, composition, pose, wardrobe, props, environment, lighting, color,
camera perspective, depth, texture, and intended photographic treatment].

PRESERVE: Keep the exact identity, facial structure, recognizable features, natural
skin texture, and plausible anatomy of the person from the reference image. Keep
the face readable; slight natural occlusion is acceptable.

REFERENCE ROLE: The input image defines identity only.

PROHIBIT: No screenshot UI, status bar, buttons, usernames, profile icons, arrows,
upload thumbnail, credits, captions, random text, logo, watermark, extra people,
duplicate body parts, malformed hands, severe face obstruction that prevents
recognition, or low resolution.
```

Do not include a fixed gender, age, skin color, face shape, hairstyle, or body type
in the effect prompt. A requested garment or pose is allowed when it defines the
template’s visual effect rather than the subject’s identity.

## Paid-model choice

- Use fal.ai `openai/gpt-image-2` by default for high-fidelity editing, complex
  instructions, selective color, and polished final imagery.
- Use fal.ai `fal-ai/nano-banana-pro` when multiple references or cross-image
  consistency materially dominate the task.
- Keep the output at `2:3`, using the exact size token exposed by the runtime
  catalog for the chosen model.
- Run one paid model first. Use the other only for an explicit comparison or a
  justified retry.

## Reference comparison and V2 decision

Compare the paid proof side by side with the main reference image. Ignore screenshot
chrome and judge the intended image across these dimensions:

1. composition, crop, subject scale, and camera angle;
2. pose, gaze, gesture, and subject-environment relationship;
3. wardrobe, props, and signature scene elements;
4. spatial layout, foreground, background, and depth;
5. light direction, contrast, color structure, and atmosphere;
6. lens feeling, texture, photographic finish, and overall mood;
7. prohibited UI, random text, anatomy errors, and severe face obstruction.

Treat creative differences as acceptable when the reference’s essential visual
logic remains recognizable. Mark **meets or exceeds** when the signature elements
and relationships are present and the result has no critical defect. Do not create
V2 in that case.

Mark **needs correction** when an important relationship is missing, reversed,
poorly framed, visually weak, or contradicted. Identify at most three high-impact
gaps. Create a revised prompt that:

- explicitly corrects those gaps;
- preserves successful composition and identity details;
- avoids rewriting unrelated clauses;
- keeps the same accepted Soul result, paid model, and `2:3` output;
- creates a separate V2 prompt and result without overwriting V1.

After V2, compare again. Stop automatic paid iteration after this one corrective
version. Report remaining gaps for user judgment.

## Visual QA checklist

### Model portrait

- Square `1:1`.
- `720p`, catalog style `General`, and prompt enhancement/expansion off.
- Soul prompt is entirely in Chinese and contains positive visual descriptions only.
- Correct region and explicit gender, or Western default when unspecified.
- Temperament, styling, expression, and setting fit the reference theme.
- High-attractiveness Instagram/TikTok blogger aesthetic with a believable adult
  non-celebrity presence.
- Everyday phone-camera realism, ordinary surroundings, and a relaxed personal-post
  feeling rather than editorial or campaign polish.
- Framing supports the reference-derived fashion and silhouette.
- Face and main features are recognizable and usable for downstream identity
  reference; slight softness or natural occlusion is acceptable.
- Natural skin, hair, shoulders, and hands.
- Incidental watermarks are acceptable and are not a regeneration reason.
- Result remains on the generation node and is not converted into a durable private
  asset.

### Paid proof

- `2:3`.
- Identity matches the accepted Soul model.
- Main reference composition and action are recognizable.
- Clothing, props, scene, light, and color relationships follow the prompt.
- Face remains clear; hands and anatomy are plausible.
- Screenshot UI and random text are absent.
- The result has a documented reference-comparison verdict.
- A separate V2 exists only when the V1 verdict was `needs correction`.
- The final candidate is suitable for user review.

### Free comparison

- Generated only after explicit approval.
- `2:3`.
- Uses the same accepted Soul generation result and the approved V1 or V2 prompt.
- Stored separately from the paid result.
- Visually inspected and arranged for side-by-side comparison.
