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
confident creator appeal, but avoid celebrity resemblance, runway stiffness,
luxury-campaign perfection, and an overly manufactured face.

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
language, and environment to the source document. Keep the overall target stable:

```text
A square Instagram/TikTok-style lifestyle or street-fashion photograph of an adult
[region and explicit gender only when required], high-attractiveness fashion
blogger presence, with a [reference-derived temperament] and believable
non-celebrity identity, [scene-compatible styling, expression, body language, and
framing], confident natural eye contact, realistic skin texture and pores,
flattering natural daylight, an understated everyday environment with gentle
depth, candid mobile-photography realism, clean color, plausible anatomy, sharp
subject detail. Slight natural face occlusion by hair, a hand, a phone, or a
foreground object is acceptable while the subject remains recognizable. No
celebrity resemblance, no stiff runway pose, no artificial beauty-filter face, no
poster design, no typography, no logo, no watermark, no interface, no distortion,
no extra limbs.
```

Avoid metadata labels such as “region:”, “model:”, or “requirements:” inside the
generation prompt. They can encourage unwanted layouts or text.

Use the following as a quality-and-detail example, adapting region, gender,
wardrobe, pose, props, and setting to the actual reference rather than copying
those identity traits into every template:

```text
成年女性，欧美高颜值时尚博主气质，金色长发自然微卷并侧分，发丝柔顺有光泽，精致对称五官，立体鼻梁，饱满嘴唇，干净利落的淡妆与自然高光，真实皮肤纹理与细腻毛孔，身材高挑纤细、腰线明显、曲线感强，站在城市林荫大道的人行道上，背景为两侧高大树木形成的绿色树冠拱廊，路边停放多辆汽车，远处可见住宅/公寓街区与街牌，铺装路面与灰色路缘清晰可见，整体是夏日午后自然光，树叶缝隙洒下斑驳光影，画面明亮通透，生活化街拍氛围，Instagram/TikTok博主风格，真实手机摄影质感，中央构图，平视角，全身入镜，人物正面朝向镜头并带自然眼神交流，手持手机与细线耳机，肩背棕色托特包，穿白色修身吊带上衣与高腰白色贴身短裤，极简性感但高级，服装面料有弹性与细节褶皱，时尚感强，色调清爽干净，背景轻微虚化，浅景深，真实抓拍感，高级感街拍，人像清晰锐利，超写实摄影，8k，细节丰富，肤质自然，光影柔和，画面没有水印、字幕、logo、社交媒体UI元素、边框、畸变和多余肢体
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
- Correct region and explicit gender, or Western default when unspecified.
- Temperament, styling, expression, and setting fit the reference theme.
- High-attractiveness Instagram/TikTok blogger aesthetic with a believable adult
  non-celebrity presence.
- No celebrity resemblance, runway stiffness, or overproduced campaign look.
- Framing supports the reference-derived fashion and silhouette.
- Face is sharp and recognizable; slight natural occlusion is acceptable.
- Natural skin, hair, shoulders, and hands.
- No typography, watermark, interface, or poster layout.
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
