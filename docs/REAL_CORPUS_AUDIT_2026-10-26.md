# Real Discord corpus audit — 26 October 2026

**This is a product-quality experiment, not a unit-test certificate.**

## Inputs and boundary

- Archived public raw Discord exports, recovered from \`archive/pre-rsm-reboot-2026-10-26\` into temporary GitHub Actions workspace.
- Minecraft redstone: 2,000 messages (663 explicit reply references).
- VR hardware development: 2,000 messages (372 explicit reply references).
- Raspberry Pi project showcase: 997 messages (no explicit reply references, 698 messages with attachments).
- Total: **4,997 genuine messages**. The separate CEMU/VR keyword-array uploads are *glossaries*, not message exports and must not be treated as conversation evidence.
- No LLM synthesis, external source retrieval, or personally attributed expertise inference was used to judge the static outputs.
- This assessment is a qualitative audit of observed index labels and retrieved messages. It is not a measured precision/recall estimate on a human-annotated dataset.

Reproducible actual-code run: [Actions corpus-quality-review](https://github.com/JadanPoll/Discord-Wiki/actions/workflows/tests.yml). The workflow reads the historical, original export bytes and publishes a JSON index snapshot; it does not bring those bulky exports back into the clean application tree.

## Index: what changed in response to actual output

**Baseline static vocabulary:** lexical document frequency rewarded generic language and repetitive templates. Minecraft surfaced \`adventurer role\`, \`builds recommend\`, \`doesn require\`, \`desktop mode\`; VR was dominated by \`even\`, \`project\`, \`making\`, \`around\`; Raspberry Pi by \`usb\`, \`game\`, \`add\`, \`done\`. These are not a good navigational index.

**Current phrase-first index:** count distinct statements, discount copy-pasted templates, retain contiguous 2–3 token concepts and a secondary keyword index. The observed high-ranking labels now include:

| Corpus | Useful returned subjects | Still problematic |
| --- | --- | --- |
| Minecraft | \`flying machines\`, \`sticky pistons\`, \`sand duper\`, \`7-segment display\`, \`redstone dust\`, \`binary adder\` | \`proven adventurer\`/role-related labels, \`holy grail\`, and overlapping variants |
| VR | \`foveated rendering\`, \`mipi dsi\`, \`fresnel lens\`, \`eye tracking\`, \`focal length\`, \`pupil dilation\`, \`csi port\` | \`humans perceive\`, \`spent millions\`, \`within month\`; names are still a bag of phrases, not a real subject taxonomy |
| Raspberry Pi | \`home assistant\`, \`xkcd bot\`, \`captive portal\`, \`computer museum\`, \`amazon dash\`, \`magic mirror\`, \`power consumption\` | Many excellent one-off project posts cannot qualify as recurring concepts; \`college students\` and other incidental collocations remain |

**Assessment:** Directionally improved and now meaningfully browsable, but not yet an admissible high-quality index in the strong PDFlets sense. A phrase's recurrence and collocation do not establish that it is a useful subject, still less that its source passages are a coherent episode.

## Real question → evidence audit (no generated answers)

| Natural question | Observed source retrieval | RSM verdict |
| --- | --- | --- |
| Why does the daylight detector activate when a block is above it? | Top hits include \`1362131198217949495\` (the follow-up question) and \`1362131060615413903\` (block-above reply). An unrelated detector-rails message is also returned. | Better after multi-term reranking; must keep query and reply context distinct. |
| How was the compact 7-segment display made? | Top: \`1361886046266069173\` (original compact build) and \`1362130285419827250\` (optimized, stackable version). | Strong: connects the actual project progression. |
| Why is the sugarcane farm not growing? | Top: \`1358430056849870858\`, exactly the user's described malfunction. Follow-on results contain some unrelated farms. | Finds the problem; *does not yet certify its solution*. |
| Can Lighthouse pose and finger rotations combine in a SteamVR driver? | Top: \`1335175831445700660\`, the proposed implementation, followed by \`1335089404007551020\`, the original question. | Strong practical retrieval; proposal is not independent proof of working hardware. |
| What does DIY eye tracking cost? | The question itself appears near the top; the important subsequent statement \`1288530064014839880\` says eye tracking parts are about **€25–40**, and a preceding message distinguishes total multi-year prototype expenses. The parts-price message was **not in the top six**. | Failure of question-to-answer continuation; needs episodic context retrieval, not merely better word matching. |
| What causes IMU drift? | Sources mention drift, IMUs, and tracker projects, but the first six do not establish a defensible causal explanation. | **Unresolved**. Do not synthesize certainty from lexical coincidence. |
| How did the Raspberry Pi Home Assistant museum tour work? | First five hits cover the controller, outlets, Amazon Dash triggers, UI and tour progression. | Strong multi-post project reconstruction. |
| Where is the MQTT Ambilight project? | Top: \`778006821344116736\`, the original project post. | Strong exact discovery. |
| What was PyPoker? | Top: \`359824135443972097\`, the original playing-card design post. | Strong exact discovery, but this one-off project is not necessarily visible in the recurring phrase index. |

## Tested architecture implications

1. **Static indexing has a finite legitimate objective.** Produce useful source pointers and enough adjacency/backreferences to support investigation. Do not confuse this with proving claims.
2. **An answer may live in a different message than the best query match.** Extend the inspectable context on demand, including explicit reply references; avoid claiming chronological neighbors form a conversational thread.
3. **Showcase archives are sparse by design.** Distinct projects can appear in one post. An index optimizing repeat frequency alone systematically misses them. The next admissibility improvement should include source-level project anchors rather than injecting an elaborate unsupervised clustering method.
4. **RSM stopping condition:** stop the static-ranker refinement once navigation quality is operationally sufficient, then test whether the Librarian's question/alternative selection actually advances real investigations. Measured advancement and interpretability are more important than arbitrary index-size or coherence scores.
5. **Adversarial limits:** claims by participants, repeated copy/paste, and thread-adjacent messages are not independently validated ground truth. Consent and context remain necessary before presenting member-specific expertise profiles.

## Current stopping judgement

**Do not declare the static-index problem solved.** Keep the phrase-first improvements and original-source navigation because actual results justify them. The next high-value change is *episode-level answer recovery for multi-message exchanges* and *one-off project navigation*, with real human review. Avoid additional decorative score functions without a demonstrated failure that changes the user's ability to find or understand relevant evidence.
