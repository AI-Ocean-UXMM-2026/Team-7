import { useEffect, useRef, useState } from "react";
import { Icon } from "@ocean/ui";
import type {
  AssistantDraftFields,
  AssistantDraftScreenshot,
} from "../main/contract.js";
import { Launcher } from "./Launcher";
import sampleTransfer from "./assets/demo-transfer.svg?url";
import dolphin from "../../../../assets/dolphin/dolphin-accountant.png";

type View = "home" | "chat" | "match";
type EditableField = "customer" | "product" | "quantity" | "price" | "delivery";
type DemoOrder = Record<EditableField, string>;

const englishSample =
  "Hi! Could I get two Mira tote bags at 22,500 kyat each? Deliver to 14 Inya Road, Yangon. The name is Thiri Mon.";
const burmeseSample =
  "မင်္ဂလာပါ။ Mira tote bag နှစ်လုံး၊ တစ်လုံး ၂၂,၅၀၀ ကျပ်။ ရန်ကုန် အင်းလျားလမ်း ၁၄ ကိုပို့ပေးပါ။ နာမည်က သီရိမွန်ပါ။";
const fixture: DemoOrder = {
  customer: "Thiri Mon",
  product: "Mira tote bag",
  quantity: "2",
  price: "22500",
  delivery: "14 Inya Road, Yangon",
};

function AssistantPanel() {
  const [view, setView] = useState<View>("home");
  const [chat, setChat] = useState(englishSample);
  const [order, setOrder] = useState<DemoOrder>({ ...fixture });
  const [hasOrder, setHasOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    void window.assistant
      .loadDraft()
      .then((draft) => {
        if (!mounted) return;
        if (draft) {
          setView(draft.fields.view);
          setChat(draft.fields.chat);
          setOrder({ ...draft.fields.order });
          setHasOrder(draft.fields.hasOrder);
          setConfirmed(draft.fields.confirmed);
          setNotice(draft.fields.notice);
          setScreenshot(draft.screenshot?.source ?? "");
          setScreenshotName(draft.screenshot?.name ?? "");
        }
        setDraftReady(true);
      })
      .catch(() => {
        if (mounted) setDraftReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const fields: AssistantDraftFields = {
      view,
      chat,
      order,
      hasOrder,
      confirmed,
      notice,
    };
    window.assistant.saveDraftFields(fields);
  }, [draftReady, view, chat, order, hasOrder, confirmed, notice]);

  useEffect(() => {
    if (!draftReady) return;
    const selectedScreenshot: AssistantDraftScreenshot | null = screenshot
      ? { source: screenshot, name: screenshotName }
      : null;
    window.assistant.saveDraftScreenshot(selectedScreenshot);
  }, [draftReady, screenshot, screenshotName]);

  function edit(field: EditableField, value: string) {
    setOrder((current) => ({ ...current, [field]: value }));
    setConfirmed(false);
    setNotice("Your edits stay in this session’s sample draft.");
  }

  function analyzeChat() {
    if (!chat.trim()) {
      setNotice("Add an example conversation first.");
      return;
    }
    setBusy(true);
    setHasOrder(false);
    setConfirmed(false);
    setNotice("Preparing your sample order…");
    window.setTimeout(() => {
      setOrder({ ...fixture });
      setHasOrder(true);
      setBusy(false);
      setNotice(
        "Your sample order is ready. Review every detail before confirming.",
      );
    }, 1050);
  }

  function readLocalImage(file: File | undefined) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice("Choose a JPG, PNG, WebP, or GIF image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setNotice("The local image could not be previewed.");
        return;
      }
      setScreenshot(reader.result);
      setScreenshotName(file.name);
      setNotice(
        "Local preview only. The image has not been uploaded or verified.",
      );
    });
    reader.addEventListener("error", () =>
      setNotice("The local image could not be read."),
    );
    reader.readAsDataURL(file);
  }

  function useExampleImage() {
    setScreenshot(sampleTransfer);
    setScreenshotName("synthetic-transfer-example.svg");
    setNotice(
      "Sample image selected. This illustration is not a real transaction.",
    );
  }

  if (window.location.search.includes("view=launcher")) return <Launcher />;

  if (!draftReady) {
    return (
      <main className="assistant-shell" aria-live="polite">
        <div className="panel-scroll">Restoring your draft…</div>
      </main>
    );
  }

  return (
    <main className="assistant-shell">
      <header className="panel-header">
        <div className="header-drag" aria-hidden="true">
          <span className="panel-mark">
            <img src={dolphin} alt="" />
          </span>
          <span className="title-copy">
            <strong>SaleSayar AI</strong>
            <small>YOUR SELLER ASSISTANT</small>
          </span>
        </div>
        <div className="window-actions">
          <button
            className="window-action"
            aria-label="Minimize assistant"
            title="Minimize assistant"
            onClick={() => void window.assistant.hideAssistant()}
          >
            −
          </button>
          <button
            className="window-action close-action"
            aria-label="Close assistant and keep draft"
            title="Close assistant and keep draft"
            onClick={() => void window.assistant.hideAssistant()}
          >
            ×
          </button>
        </div>
      </header>
      <div className="panel-scroll">
        <div className="demo-ribbon">
          <span aria-hidden="true">●</span> Sample workspace{" "}
          <span className="ribbon-divider">·</span> Simulated flows
        </div>
        {view === "home" ? (
          <>
            <section className="panel-welcome">
              <span className="eyebrow">A little help with the busy bits</span>
              <h1>Your shop, a little simpler.</h1>
              <p>
                A little help turning conversations into clearer next steps.
              </p>
            </section>
            <div className="action-list" aria-label="Choose an assistant workflow">
              <button
                className="action-card chat-action"
                onClick={() => {
                  setView("chat");
                  setNotice("");
                }}
              >
                <span className="action-icon chat-icon">
                  <Icon name="sales" size={22} />
                </span>
                <span className="action-copy">
                  <strong>Chat to Order</strong>
                  <small>
                    Turn a sample conversation into an editable order
                  </small>
                </span>
                <span className="action-arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <button
                className="action-card match-action"
                onClick={() => {
                  setView("match");
                  setNotice("");
                }}
              >
                <span className="action-icon match-icon">
                  <Icon name="wallet" size={22} />
                </span>
                <span className="action-copy">
                  <strong>Screenshot to Order Match</strong>
                  <small>
                    Preview an image and review a sample match
                  </small>
                </span>
                <span className="action-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
            <div className="assistant-note">
              <span className="note-mark">i</span>
              <p>
                Try the sample flows with confidence. Nothing leaves this device;
                live AI and financial accounts aren’t connected.
              </p>
            </div>
          </>
        ) : (
          <>
            <button
              className="back-link"
              onClick={() => {
                setView("home");
                setNotice("");
              }}
            >
              <span aria-hidden="true">←</span> Back to assistant
            </button>
            {view === "chat" ? (
              <section className="workflow" aria-labelledby="chat-heading">
                <div className="workflow-heading">
                  <span className="workflow-icon">
                    <Icon name="sales" />
                  </span>
                  <div>
                    <span className="eyebrow">A conversation, organized</span>
                    <h1 id="chat-heading">Chat to Order</h1>
                  </div>
                </div>
                <label className="field-label" htmlFor="customer-chat">
                  Sample customer chat
                </label>
                <p className="field-hint">
                  Edit or paste an English or Burmese message. Text stays in
                  this panel.
                </p>
                <textarea
                  id="customer-chat"
                  className="chat-input"
                  value={chat}
                  onChange={(event) => setChat(event.target.value)}
                  placeholder="Paste a sample customer conversation…"
                />
                <button
                  className="language-sample"
                  onClick={() =>
                    setChat((current) =>
                      current.startsWith("မင်္ဂလာပါ")
                        ? englishSample
                        : burmeseSample,
                    )
                  }
                >
                  <span aria-hidden="true">文</span> Use{" "}
                  {chat.startsWith("မင်္ဂလာပါ") ? "English" : "Burmese"} sample
                </button>
                <button
                  className="primary-button analyze-button"
                  disabled={busy}
                  onClick={analyzeChat}
                >
                  {busy ? (
                    <>
                      <span className="button-spinner" aria-hidden="true" />{" "}
                      Dolphin is thinking…
                    </>
                  ) : (
                    "Analyze Chat"
                  )}
                </button>
                {busy && (
                  <div className="thinking-card" role="status">
                    <span className="thinking-mascot">
                      <img src={dolphin} alt="" />
                    </span>
                    <span>
                      <strong>A little thinking time</strong>
                      <small>
                        A simulated preview of chat extraction.
                      </small>
                    </span>
                    <span className="thinking-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                )}
                {hasOrder && (
                  <section
                    className="order-preview"
                    aria-labelledby="order-heading"
                  >
                    <div className="preview-header">
                      <div>
                        <span className="eyebrow">
                          Order draft
                        </span>
                        <h2 id="order-heading">Review your order</h2>
                      </div>
                      <span className="preview-badge">Sample</span>
                    </div>
                    <p className="fixture-note">
                      This simulated extraction uses a preset example, not the
                      pasted message. Review and edit it to try the flow.
                    </p>
                    <div className="field-grid">
                      <label className="form-field">
                        Customer
                        <input
                          autoComplete="off"
                          value={order.customer}
                          onChange={(event) =>
                            edit("customer", event.target.value)
                          }
                        />
                      </label>
                      <label className="form-field">
                        Product
                        <input
                          autoComplete="off"
                          value={order.product}
                          onChange={(event) =>
                            edit("product", event.target.value)
                          }
                        />
                      </label>
                      <label className="form-field">
                        Quantity
                        <input
                          inputMode="numeric"
                          type="number"
                          min="1"
                          max="99"
                          value={order.quantity}
                          onChange={(event) =>
                            edit("quantity", event.target.value)
                          }
                        />
                      </label>
                      <label className="form-field">
                        Unit price (MMK)
                        <input
                          inputMode="numeric"
                          type="number"
                          min="0"
                          step="1"
                          value={order.price}
                          onChange={(event) =>
                            edit("price", event.target.value)
                          }
                        />
                      </label>
                      <label className="form-field field-wide">
                        Delivery address
                        <textarea
                          value={order.delivery}
                          onChange={(event) =>
                            edit("delivery", event.target.value)
                          }
                          rows={2}
                        />
                      </label>
                    </div>
                    <div className="line-total">
                      <span>Sample order total</span>
                      <strong>
                        {(
                          (Number(order.quantity) || 0) *
                          (Number(order.price) || 0)
                        ).toLocaleString("en-US")}{" "}
                        MMK
                      </strong>
                    </div>
                    <button
                      className="primary-button confirm-button"
                      onClick={() => {
                        setConfirmed(true);
                        setNotice(
                          "Sample confirmation complete. No order was saved or sent.",
                        );
                      }}
                    >
                      Confirm sample order
                    </button>
                    {confirmed && (
                      <div className="confirmation-note" role="status">
                        <img className="reaction-mascot" src={dolphin} alt=""/>
                        <span>
                          <strong>Sample order reviewed</strong>
                          <small>Confirmation simulated. No order was saved.</small>
                        </span>
                      </div>
                    )}
                  </section>
                )}
              </section>
            ) : (
              <section className="workflow" aria-labelledby="match-heading">
                <div className="workflow-heading">
                  <span className="workflow-icon">
                    <Icon name="wallet" />
                  </span>
                  <div>
                    <span className="eyebrow">A helpful second look</span>
                    <h1 id="match-heading">Screenshot to Order Match</h1>
                  </div>
                </div>
                <div className="security-note">
                  <strong>Review, then check your records</strong>
                  <p>
                    Matching is simulated. Images stay on this device. A screenshot
                    alone cannot confirm received funds.
                  </p>
                </div>
                <div className="sample-actions">
                  <button
                    className="primary-button sample-button"
                    onClick={useExampleImage}
                  >
                    Use sample image
                  </button>
                  <label className="secondary-button file-button">
                    Choose local image
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) =>
                        readLocalImage(event.currentTarget.files?.[0])
                      }
                    />
                  </label>
                </div>
                {screenshot && (
                  <>
                    <figure className="image-preview">
                      <img
                        src={screenshot}
                        alt="Selected local image preview"
                      />
                      <figcaption>
                        <span>Local image preview</span>
                        <span>{screenshotName}</span>
                      </figcaption>
                    </figure>
                    <section
                      className="match-card"
                      aria-labelledby="match-order-heading"
                    >
                      <div className="preview-header">
                        <div>
                          <span className="eyebrow">
                            Suggested order
                          </span>
                          <h2 id="match-order-heading">Possible order match</h2>
                        </div>
                        <span className="match-score">Sample</span>
                      </div>
                      <p className="fixture-note">This preset suggestion does not analyze your image.</p>
                      <div className="match-order">
                        <div className="order-symbol">
                          <Icon name="orders" />
                        </div>
                        <div>
                          <strong>Order #SS-1048</strong>
                          <small>Thiri Mon · 2 × Mira tote bag</small>
                        </div>
                      </div>
                      <div className="match-detail">
                        <span>Illustrative amount</span>
                        <strong>45,000 MMK</strong>
                      </div>
                      <div className="review-status">
                        <span className="review-dot" aria-hidden="true" />
                        <span>
                          <strong>Needs your review</strong>
                          <small>
                            Suggestion only · no transfer status is set
                          </small>
                        </span>
                      </div>
                      <button
                        className="secondary-button review-button"
                        onClick={() =>
                          setNotice(
                            "Suggestion reviewed for this session. Check trusted payment records before confirming funds. No payment status has changed.",
                          )
                        }
                      >
                        Review suggestion
                      </button>
                    </section>
                  </>
                )}
              </section>
            )}
          </>
        )}
        {notice && !busy && (
          <p className="status-message" role="status">
            {notice}
          </p>
        )}
        <footer className="panel-footer">
          <span className="footer-pulse" aria-hidden="true" /> Local to this session · No live services connected
        </footer>
      </div>
    </main>
  );
}

export default function AssistantApp() {
  if (window.location.search.includes("view=launcher")) return <Launcher />;
  return <AssistantPanel />;
}
