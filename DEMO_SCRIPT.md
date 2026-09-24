# Two-minute Larynx AI demo

## 0:00–0:20 · Set the scene

Open the Lead Response Studio and point to the mode pill. For a prospect presentation, keep it on **DEMO MODE**. Explain: “This is a safe, local story run. It shows the experience without calling a buyer or sending a message.” The top rail summarizes the operating window, follow-up cap and retry cadence.

## 0:20–0:45 · Introduce an enquiry

Choose **Fill sample lead**. Read the name, property and source out loud. Point to the two separate permissions: “A request to call does not automatically opt someone into WhatsApp. Each channel is checked on its own.” Enter the private demo passcode and click **Send test lead**.

## 0:45–1:10 · Show the response story

Watch the timeline progress: lead received, phone checked, permissions checked, call hand-off illustrated, WhatsApp provider acceptance illustrated, then logged. Call out the large first-call clock and its **Illustrative timing** label. The run stays inside the browser; no n8n or provider request leaves the app.

Uncheck call consent or WhatsApp opt-in and run again if you want to show a channel being skipped. The timeline explains why in plain language.

## 1:10–1:40 · Open the lead ledger

Click Aarav Mehta or another row. Point out the masked phone, intent badge, call/WhatsApp state and IST follow-up time. In the drawer, show the Hinglish summary, interests, objection, budget signal, recommended action and its reason. The retry log uses human language and distinguishes an uncertain provider outcome from a confirmed failure.

## 1:40–2:00 · Close on the six steps

Expand **How it works** and walk across the six cards: arrival, validation, consent, first response, analysis, next action. Close with: “The point is not only speed—it is a traceable, consent-aware conversation with a clear next step.”

## If you are in TEST MODE

The form posts to the authenticated intake webhook and reads the read-only API. Say: “The webhook acknowledged the request. TEST_MODE sends this execution to a health path, so this lead is not staged and no real call or WhatsApp is sent. The detailed health report lives in n8n execution history.” Do not describe `accepted:true` as a placed call or delivered message.
