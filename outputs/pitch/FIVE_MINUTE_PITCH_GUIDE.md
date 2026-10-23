# Four Hook — five-minute pitch and solo recording guide

Prepared 23 October 2026. Product: တူတူတွက်မယ်. Language: English.

Target: finish speaking by 4:55, leaving five seconds below the five-minute limit. The timestamp plan is a rehearsal target, not a measured recording. The script has about 565 words, averaging about 115 spoken words per minute across the full video. Slide passages need about 125–140 wpm, while demo passages leave room for clicks and pauses. The actual AI response time must be rehearsed.

## What was reviewed

- All 13 Canva slides through their visible text, with visual checks of research, pricing, and team slides: https://www.canva.com/design/DAHYpw5lE2U/baPfDqwXiCckxsFL_vb-yA/edit
- Official judging document: https://docs.google.com/document/d/1thSzJyLkVUIkqmquIYg4tq7ONzVYRka1-ZW5pHFaTiA/edit
- The supplied screenshot's video guidance: name, role, team; problem and solution; product demonstration; optional reflection. Slides are optional.
- Hosted login and public synthetic dashboard: https://ocean-ai-assistant-3vun.vercel.app/demo
- Local PRD, architecture, user flows, existing demo script, Electron workflow implementation, payment-review implementation, and pricing component.

Limit: authenticated shop operations and the local Electron window were not executed during this review. Source inspection is not an end-to-end test. The private Sales route required sign-in. No app or Canva content was changed.

## Judging strategy

| Stage | Criteria | How this pitch supplies evidence |
| --- | --- | --- |
| Async mentor review | AI/workflow 25%; UI/UX 25%; tech execution 20%; business/problem fit 15%; process 15% | Show one coherent workflow, a field correction, explicit approval, the saved record, and a concise account of sprint delivery and next validation priorities. |
| Final jury pitch | Presentation 25%; storytelling 25%; business viability 25%; AI leverage 25% | Keep timing and delivery controlled; follow one seller problem through its resolution; explain pricing and acquisition hypotheses; show precisely what AI does. |

The final-stage document lists 1 November. Use this video to satisfy the async review while keeping a strong final-pitch structure. Do not let a long market lecture crowd out the working demo. Narrative pattern: situation, complication, resolution, supported by visible product evidence.

## Corrections to make before recording

1. **Slide 4:** the 50% circle repeats “Had to resend payment screenshots (27 out of 50).” Twenty-seven of fifty is 54%, not 50%. Remove that duplicated fourth item or replace it with the actual measured finding. Do not invent a replacement. Thirty-four of fifty = 68%; twenty-seven = 54%; forty-four = 88%. The sample is shoppers, not sellers: it supports customer friction, not seller willingness to pay. Use the script's survey sentence only if the team has the underlying responses. Otherwise replace it with: “Delayed confirmations and repeated payment requests are the customer problems we want to test. Our next step is observing sellers complete this workflow and measuring where their time goes.”
2. **Slides 2 and 8:** slide 2 says 21,088 while slide 8 says 21,008. A 10 July 2025 report states 21,088 registrations between 2 October 2023 and June 2025. Use the correct number with that historical scope and source, not as a verified current active market. Source: https://www.gnlm.com.mm/moc-approves-record-21000-e-commerce-firms-in-24-months/
3. **Slide 2:** 21.0 million refers to social-media user identities in October 2025; those are not necessarily unique people or sellers. Source: https://datareportal.com/reports/digital-2026-myanmar
4. **Slide 8:** 6,000 reachable shops and 300 shops are illustrative assumptions/goals, not researched TAM/SAM/SOM estimates or traction. Label them clearly. Explain the seller segment and recruitment plan. Registered operators are a market reference, not automatically a validated TAM.
5. **Slide 9:** 300 paying Pro shops × 15,000 MMK/month × 12 = 54,000,000 MMK annualized revenue. If you grow to 300 by year end, that is not automatically first-year revenue. It assumes all 300 pay Pro rates; free users do not count. Keep it labelled as an illustrative annualized scenario. The 134-shop break-even claim cannot be validated without fixed costs and variable costs per shop; remove it or include the actual model. Formula: fixed monthly costs / (monthly revenue per paying shop − variable monthly cost per paying shop), rounded up. Include AI, hosting, payment charges and support costs. The existing “unlimited” Pro AI offer needs a sustainable usage/cost model before being defended.
6. **Slides 1 and 5:** “Your Entire Sales Team” is an ambitious promise. The spoken script uses the concrete assistant workflow. “Smart Message Capture” should mean seller-selected copy/paste unless another demonstrated capability exists. Do not imply automatic private Messenger access.
7. **Slide 9 visual:** pricing cards and the chart appeared blurry in the shared deck. Replace low-resolution captures with readable text or sharper assets before export. Keep prices readable at video size.
8. **Slide 13:** “See you on the Final Day!” fits the async submission. For the final-stage version, replace it with the product tagline and pilot invitation.

## The timed script

Only the spoken paragraphs are narration. Directions and timestamps are not spoken. Use the product's Burmese name naturally. The seller story is hypothetical and demo data is synthetic.

## 0:00–0:18 | 1 · Opening

**On screen / delivery:** Camera + title slide. Look into the lens. One small open-palm gesture. Replace [name] and [role].

Imagine finishing a busy day of selling, then spending your evening figuring out which orders are paid. I’m [name], [role] from Four Hook. We built တူတူတွက်မယ် to help Myanmar online sellers manage that work.

## 0:18–0:31 | 2 · Opportunity

**On screen / delivery:** Advance to slide 2. Do not read the statistics aloud. Keep dated source footnotes on the slide.

Social media brings customers to small businesses. But behind each conversation, one seller still has to connect the order, the payment, and the financial record.

## 0:31–0:47 | 3 · Pain points

**On screen / delivery:** Advance to slide 3. Use a hypothetical seller, not an invented interview quotation. Pause after the final question.

Picture a seller receiving an order in Messenger, a payment screenshot later, and a quantity change in another message. Information gets scattered. The day ends with a simple question: how much did I actually earn?

## 0:47–1:04 | 4 · Research

**On screen / delivery:** Advance to slide 4. Use these numbers only if the team can substantiate its survey. Fix the duplicate/mismatched item first.

Our survey of fifty online shoppers found that thirty-four experienced delayed order confirmation, and twenty-seven had to resend payment screenshots. That shows customer friction. Our next validation step is testing the seller’s workflow directly.

## 1:04–1:18 | 5 · Solution

**On screen / delivery:** Advance to slide 5. On the final sentence, move to slide 6 and switch to the prepared Messenger/browser view.

တူတူတွက်မယ် connects those steps through a floating desktop assistant and a business dashboard. The seller brings in the conversation, reviews the AI’s work, and stays in control. Let me show you.

## 1:18–1:38 | 6 · Demo: chat

**On screen / delivery:** Show a real browser conversation containing synthetic data. Open the actual floating Electron dolphin and paste. Begin extraction promptly.

This is a synthetic customer conversation. The customer orders two shirts. I copy the messages and open our dolphin over Messenger. I paste them into Chat to Order, so the seller chooses exactly what to share.

## 1:38–2:00 | 6 · Demo: review

**On screen / delivery:** Show the missing field. Read the prepared follow-up and manually correct it. Keep the test phone number already available. Approve/save; wait for success.

AI prepares the order details for review. Here, the delivery address is missing. I add it from the customer’s follow-up message, then check the quantity and price. Only after my approval does the order save to the shop.

## 2:00–2:15 | 6 · Demo: voucher

**On screen / delivery:** Show the saved order's voucher preview. Hold still for two seconds. Skip download/print dialogs.

Now I can show the voucher for that order. The customer details and item total are already there. The seller can review the result without typing the same information into another document.

## 2:15–2:48 | 6 · Demo: payment

**On screen / delivery:** Switch to Screenshot to Order Match. Upload the rehearsed image, analyze, select candidate, and attach as pending review. Then switch to the website's Payments tab, compare with a clearly labelled synthetic record, and demonstrate seller confirmation in the designated test workspace.

Next, I upload a synthetic payment screenshot. AI extracts the available details, and the app suggests a matching order. I review and attach the evidence, then open Payments on the website. A screenshot alone does not prove money arrived. In this demonstration, I compare it with our prepared sample payment record before confirming.

## 2:48–3:08 | 6 · Demo: dashboard

**On screen / delivery:** Open the authenticated shop dashboard, refresh if needed, use a date range that includes the order and payment. Point once to sales and once to payments. Never substitute the unrelated public sample dashboard as proof of sync.

Back on the dashboard, we can see the saved order and confirmed payment. Sales, money received, and estimated profit remain separate. With product costs and expenses recorded, the seller gets a clearer picture of the business.

## 3:08–3:30 | 7 · AI leverage

**On screen / delivery:** Return directly to slide 7. Explain the division between AI extraction, application matching/calculation rules, and human decisions.

AI handles the messy language and image inputs. Application rules calculate the money, while the seller approves the business decisions. That combination turns an AI response into a usable workflow, with editable fields and visible review steps.

## 3:30–3:43 | 8 · Market

**On screen / delivery:** Advance to slide 8. This pilot-recruitment approach is a proposal to adopt, not evidence of existing partnerships or traction.

Our starting customer is a Myanmar social seller managing orders manually. We propose recruiting pilot shops through seller communities, then measuring repeat use before pursuing our illustrative three-hundred-shop goal.

## 3:43–4:10 | 9 · Business model

**On screen / delivery:** Advance to slide 9. Describe pricing as proposed and the revenue number as an annualized scenario. Keep the model assumptions visible.

Our proposed model starts free, with Pro at fifteen thousand kyat per month and Team at thirty-five thousand. Three hundred paying Pro shops would represent fifty-four million kyat in annualized revenue. That is a scenario. Pilot conversion, retention, and AI cost per shop will determine whether it works.

## 4:10–4:25 | 10 · Execution

**On screen / delivery:** Advance to slide 10. Only claim the work actually completed. Do not invent test results, adoption, or time savings.

During this sprint, we built the merchant website and desktop assistant around two AI workflows. Our next validation priorities are order accuracy, time to complete a reviewed order, and sellers’ willingness to pay.

## 4:25–4:37 | 11 · Differentiation

**On screen / delivery:** Advance to slide 11. One small open-palm gesture. Avoid reading all four boxes.

Our focus is the seller’s daily routine, from a customer conversation to a clear financial record. The floating assistant keeps help close to the work.

## 4:37–4:47 | 12 · Team

**On screen / delivery:** Advance to slide 12. Acknowledge the team without listing every biography.

Four Hook combines development, UX, product ownership, and project management. We’re seeking pilot sellers and mentors for our next step.

## 4:47–4:55 | 13 · Close

**On screen / delivery:** Advance to slide 13. Look directly into the lens. Smile lightly; hold still for two seconds after speaking.

တူတူတွက်မယ်. From chat to order, from order to profit. More clarity for the seller. Thank you.

## Prepare one consistent demo

Use a designated synthetic test shop signed in on both surfaces. Connect Electron to the same hosted service and shop before recording, including any one-time connection flow. Hide authentication work from the pitch by completing it beforehand.

A simple proposed fixture is two shirts at 22,500 MMK each, with zero delivery charge and zero discount: 45,000 MMK total. Start without the delivery address so the review has one clear purpose. Prepare a customer follow-up with a fictional address and an established synthetic test phone number; the current desktop validation requires a phone number when an address is supplied. Add the address from that follow-up and check quantity without fabricating an extraction failure.

Match the payment image and the separately prepared synthetic payment record to the same amount, customer, reference, and date. The repository's illustrative transfer SVG says 45,000 MMK and SAMPLE-1048, but it is only a preview asset with limited fields. Do not assume the upload accepts SVG or that it is a complete fixture. Use a supported PNG/JPEG prepared and tested before recording, and show any required corrections honestly. Do not call the sample record a real bank confirmation.

Expected transitions to check:

- Draft extraction alone does not increase saved sales.
- Seller approval creates the saved order; a voucher preview by itself is not proof of persistence.
- Attaching screenshot evidence leaves it pending review and does not increase confirmed payments.
- The seller's explicit confirmation, after the record comparison, is the payment event.
- Confirm the saved order and payment appear in the same website workspace. Use the proper date filter and refresh when needed.
- Show estimated profit only with known product costs and expenses. Do not equate sales or cash received with profit; do not promise a specific profit change without calculating the expected result.

The main demo gets 110 seconds. Rehearse this exact path three times with separate prepared test records so duplicate-evidence protection does not interrupt the pitch. Do not disable those protections. Check whether website Payments needs an additional review dialog and budget for it.

If the AI is slow, the review explanation can cover a short wait. If the complete workflow does not reliably fit, reduce narration elsewhere or prepare a clearly disclosed backup recording of the real workflow. Do not switch from live extraction to simulated output without saying so. A usable backup line is: “This is a recorded run of the same workflow using synthetic data.” If the backup uses simulation, explicitly say “simulated workflow.” The supplied guidelines do not establish editing rules; the default plan below is one continuous real demo within the pitch.

## Recording alone on Windows

Recommended arrangement: record the desktop directly with OBS and put a small webcam image in an unused corner. Use the same screen-and-camera composition throughout so you only switch between slides and the product. Do not film the laptop screen with a phone.

1. Run OBS's Auto-Configuration Wizard for recording. Start with 1920×1080 at 30 fps if the machine records it smoothly. Add Display Capture for the monitor containing slides, browser, and Electron, a webcam Video Capture Device, and your microphone. Display Capture is useful here because the dolphin and browser are separate windows. Verify the actual recording captures both; window capture alone may omit the floating assistant.
2. Place the webcam frame where it does not cover the assistant, primary buttons, figures, or slide text. In the full recording, a width around 15–20% of the frame is a useful starting point. Check every demo surface, including the right-hand order drawer. If needed, use a small fixed margin beside the captured screen rather than covering content.
3. Put the webcam at eye level. Frame yourself from mid-chest upward with a little space above the head. Face a window or a soft lamp; avoid a bright window behind you. Wear a plain top that contrasts with the background, and keep the background simple.
4. Record in a quiet room. Keep a headset or microphone close enough for clear speech, without rubbing against clothes. Use one active microphone source and disable duplicate audio sources. Check that the voice does not clip. Omit background music for clear narration.
5. Open the deck in presentation mode, pre-open Messenger, Payments, and the dashboard, and place the image file in an easy-to-find demo folder. Keep the dolphin away from the slide text. Disable notifications and close unrelated windows; use synthetic messages and records throughout.
6. Keep a large-print cue sheet beside the lens with only: INTRO → PROBLEM → EVIDENCE → SOLUTION → DEMO → AI → MARKET/PRICE → EXECUTION → TEAM → CLOSE. Put timing anchors beside DEMO (1:18), AI (3:08), and CLOSE (4:47). A paper cue sheet stays outside the desktop recording.
7. Make a 20-second test that includes opening the dolphin, changing browser/slide windows, and speaking normally. Play the saved file back: check overlay visibility, small-text legibility, webcam placement, microphone clarity, and echo. A preview alone is not enough.
8. Record a continuous take. The script switches from slide 6 to the actual desktop workflow and returns to slide 7. The app demonstration sits in the middle of the pitch; it does not have to be embedded as a video inside the PPTX. Use an embedded demo video only as a disclosed backup if submission rules permit it.
9. OBS recommends MKV for resilient recording; use File → Remux Recordings to produce MP4 if the submission needs MP4. Watch the exported file all the way through and check its actual duration is below 5:00, including the opening and final hold.

OBS references: https://obsproject.com/kb/quick-start-guide and https://obsproject.com/kb/standard-recording-output-guide

## Delivery, gaze, and hand gestures

Sit upright with both feet on the floor and relaxed shoulders. Stay seated for the whole recording so operating the mouse does not break your delivery. Aim for the calm confidence of someone showing a useful product to a real seller.

- **Opening:** look into the lens, give a small smile, and use one open palm near chest level. Start after a quiet breath; do not rush the first sentence.
- **Problem:** soften the smile, speak with concern, and pause after “how much did I actually earn?” Avoid acting out exaggerated panic.
- **Solution:** make one small outward gesture on the product introduction, then return the hand to a relaxed resting position.
- **Demo:** looking at the screen is natural. Keep your mouse movement slow, click once, and stop moving the pointer when the result appears. Say the benefit and review decision rather than narrating every click. You do not need simultaneous hand gestures while operating the app.
- **AI review and payment:** slow down slightly on “Only after my approval” and “A screenshot alone does not prove money arrived.” These are differentiating product decisions. Let the screen show the evidence.
- **Business model:** use a steady tone and neutral hands. State the prices clearly. Briefly pause before “That is a scenario.”
- **Close:** return your gaze to the lens, use a small smile, finish “Thank you,” and hold still for two seconds before stopping the recording.

Keep gestures inside the camera frame, generally between your lower chest and shoulders. One natural gesture at a change of idea is enough. Avoid clasping and unclasping repeatedly, pointing at the lens, swivelling in the chair, clicking a pen, or moving hands on every word. Do not force an accent. Clear pronunciation and natural pauses matter more than sounding dramatic.

## Rehearsal and final check

First rehearse the demo without speaking; next rehearse the complete script with a timer; then record a full test and review it. Memorize the opening, transitions, and close, not every sentence. If over time, cut phrases or shorten optional slide commentary before accelerating the voice. Keep the field correction, approval, payment distinction, and pricing explanation.

If more than 10 seconds behind at 3:08, shorten slide 7 to: “AI structures the messages and images. Application rules calculate the money. The seller reviews and approves.” Shorten slide 11 to: “We connect the seller's daily workflow, from chat to a clear financial record.” These cuts preserve the core message.

Before submission verify: under five minutes; correct name/role/team; current product name; legible screen; audible narration; no notifications or private data; authentic workflow; clear synthetic-data label; matching order and payment; supported survey claims; labelled business assumptions; closing hold; and successful playback of the final MP4.

This work prepared narration and guidance. It did not modify the product, record a video, export the Canva deck, or test the authenticated Electron-to-website flow. Those are the remaining preparation steps.

