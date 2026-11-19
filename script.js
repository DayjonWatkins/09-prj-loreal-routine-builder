// Keep the Worker URL here; the API key stays securely on the Worker.
const workerUrl = "https://lorealaichatbot.dayjonwatkins0317.workers.dev/";
const savedProductsKey = "loreal-routine-selected-products";
const systemMessage = {
  role: "system",
  content:
    "You are a friendly L'Oréal beauty advisor. Use the user's selected product details to create a practical, clearly ordered routine and explain when and how to use each product. For follow-up questions, use the full conversation and stay within skincare, haircare, makeup, fragrance, product use, and related beauty topics. If asked about something unrelated, briefly say you can help with beauty and routine questions instead. Do not diagnose medical conditions or promise results.",
};

const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedCount = document.getElementById("selectedCount");
const clearSelectionsButton = document.getElementById("clearSelections");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const chatWindow = document.getElementById("chatWindow");
const chatStatus = document.getElementById("chatStatus");

let products = [];
let selectedProductIds = new Set();
let messages = [systemMessage];
let chatEntries = [];
let hasGeneratedRoutine = false;
let isRequesting = false;

// Build interface elements with textContent so product data is displayed as text.
function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

function renderProducts(productsToShow) {
  productsContainer.replaceChildren();

  if (productsToShow.length === 0) {
    productsContainer.append(
      makeElement("p", "placeholder-message", "No products match your search and category filters.")
    );
    return;
  }

  productsToShow.forEach((product) => {
    const isSelected = selectedProductIds.has(product.id);
    const card = makeElement("button", "product-card");
    card.type = "button";
    card.dataset.productId = product.id;
    card.setAttribute("aria-pressed", String(isSelected));
    if (isSelected) {
      card.classList.add("is-selected");
    }

    const image = makeElement("img", "product-image");
    image.src = product.image;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.classList.add("image-unavailable"), {
      once: true,
    });

    const details = makeElement("span", "product-info");
    details.append(
      makeElement("span", "product-brand", product.brand),
      makeElement("span", "product-name", product.name),
      makeElement("span", "product-description", product.description)
    );

    const selectionLabel = makeElement(
      "span",
      "selection-label",
      isSelected ? "Added to your edit" : "＋ Add to your edit"
    );
    details.append(selectionLabel);
    card.append(image, details);
    productsContainer.append(card);
  });
}

function renderCurrentCategory() {
  const searchTerm = productSearch.value.trim().toLowerCase();
  if (!categoryFilter.value && !searchTerm) {
    renderProducts(products);
    return;
  }

  const matchingProducts = products.filter((product) => {
    const matchesCategory =
      !categoryFilter.value || product.category === categoryFilter.value;
    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
      ...(Array.isArray(product.keywords) ? product.keywords : []),
    ]
      .join(" ")
      .toLowerCase();

    return matchesCategory && searchableText.includes(searchTerm);
  });

  renderProducts(matchingProducts);
}

function saveSelectedProducts() {
  try {
    localStorage.setItem(savedProductsKey, JSON.stringify([...selectedProductIds]));
    chatStatus.textContent = "";
  } catch (error) {
    chatStatus.textContent = `Your selections could not be saved in this browser: ${error.message}`;
  }
}

function renderSelectedProducts() {
  selectedProductsList.replaceChildren();
  const selectedProducts = products.filter((product) =>
    selectedProductIds.has(product.id)
  );

  selectedCount.textContent = String(selectedProducts.length);
  clearSelectionsButton.disabled = selectedProducts.length === 0;
  generateRoutineButton.disabled = selectedProducts.length === 0 || isRequesting;

  if (selectedProducts.length === 0) {
    selectedProductsList.append(
      makeElement("p", "empty-selection", "Your edit is waiting to take shape.")
    );
    return;
  }

  selectedProducts.forEach((product) => {
    const item = makeElement("div", "selected-product");
    const name = makeElement("span", "selected-product-name", product.name);
    const removeButton = makeElement("button", "remove-product", "Remove");
    removeButton.type = "button";
    removeButton.dataset.productId = product.id;
    removeButton.setAttribute("aria-label", `Remove ${product.name}`);
    item.append(name, removeButton);
    selectedProductsList.append(item);
  });
}

function renderChat() {
  chatWindow.replaceChildren();

  if (chatEntries.length === 0) {
    chatWindow.append(
      makeElement(
        "p",
        "chat-welcome",
        "Your beauty conversation starts here. Choose a few products above and generate a routine to get started."
      )
    );
    return;
  }

  chatEntries.forEach((message) => {
    const bubble = makeElement(
      "div",
      `chat-message ${message.role === "assistant" ? "assistant-message" : "user-message"}`,
      message.content
    );
    chatWindow.append(bubble);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateRequestControls() {
  isRequesting = false;
  generateRoutineButton.disabled = selectedProductIds.size === 0;
  userInput.disabled = false;
  sendButton.disabled = !hasGeneratedRoutine;
  chatForm.setAttribute("aria-busy", "false");
}

// Changing the edit invalidates a previously generated routine and starts a
// fresh conversation so follow-up answers cannot use outdated product context.
function resetRoutineWhenSelectionsChange() {
  if (!hasGeneratedRoutine) {
    return;
  }

  hasGeneratedRoutine = false;
  messages = [systemMessage];
  chatEntries = [];
  userInput.placeholder = "Ask a beauty or routine question...";
  renderChat();
  chatStatus.textContent = "Generate a new routine after updating your selected products.";
}

// Send the full chat history to the class Worker and keep successful turns in memory.
async function sendToWorker(apiContent, displayContent, successMessage) {
  if (isRequesting) {
    return false;
  }

  isRequesting = true;
  generateRoutineButton.disabled = true;
  userInput.disabled = true;
  sendButton.disabled = true;
  chatForm.setAttribute("aria-busy", "true");
  chatStatus.textContent = "Connecting with your beauty advisor…";

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...messages, { role: "user", content: apiContent }],
      }),
    });

    if (!response.ok) {
      throw new Error(`The Worker returned an HTTP ${response.status} response.`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || reply.trim() === "") {
      throw new Error("The Worker response did not contain a valid assistant reply.");
    }

    messages.push(
      { role: "user", content: apiContent },
      { role: "assistant", content: reply }
    );
    chatEntries.push(
      { role: "user", content: displayContent },
      { role: "assistant", content: reply }
    );
    renderChat();
    if (successMessage) {
      successMessage(reply);
    }
    chatStatus.textContent = "";
    return true;
  } catch (error) {
    chatStatus.textContent = `Sorry, your message could not be sent. ${error.message}`;
    return false;
  } finally {
    updateRequestControls();
  }
}

// Load the catalog, restore saved choices, and show the empty states.
async function initialize() {
  renderChat();

  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error(`Product data returned an HTTP ${response.status} response.`);
    }
    const data = await response.json();
    if (!Array.isArray(data.products)) {
      throw new Error("Product data is missing its products list.");
    }
    products = data.products;

    try {
      const savedIds = JSON.parse(localStorage.getItem(savedProductsKey) || "[]");
      if (Array.isArray(savedIds)) {
        selectedProductIds = new Set(
          savedIds.filter((id) => products.some((product) => product.id === id))
        );
      }
    } catch (error) {
      chatStatus.textContent = `Saved selections could not be restored: ${error.message}`;
    }

    renderSelectedProducts();
    renderProducts(products);
  } catch (error) {
    productsContainer.replaceChildren(
      makeElement("p", "placeholder-message error-message", `Products could not be loaded: ${error.message}`)
    );
  }
}

categoryFilter.addEventListener("change", () => {
  renderCurrentCategory();
});

productSearch.addEventListener("input", () => {
  renderCurrentCategory();
});

productsContainer.addEventListener("click", (event) => {
  const card = event.target.closest(".product-card");
  if (!card) {
    return;
  }

  const product = products.find(
    (item) => String(item.id) === card.dataset.productId
  );
  if (!product) {
    return;
  }

  if (selectedProductIds.has(product.id)) {
    selectedProductIds.delete(product.id);
  } else {
    selectedProductIds.add(product.id);
  }

  resetRoutineWhenSelectionsChange();
  saveSelectedProducts();
  renderCurrentCategory();
  renderSelectedProducts();
});

selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-product");
  if (!removeButton) {
    return;
  }

  const productId = products.find(
    (product) => String(product.id) === removeButton.dataset.productId
  )?.id;
  if (productId === undefined) {
    return;
  }

  selectedProductIds.delete(productId);
  resetRoutineWhenSelectionsChange();
  saveSelectedProducts();
  renderSelectedProducts();
  renderCurrentCategory();
});

clearSelectionsButton.addEventListener("click", () => {
  selectedProductIds.clear();
  resetRoutineWhenSelectionsChange();
  saveSelectedProducts();
  renderSelectedProducts();
  renderCurrentCategory();
});

generateRoutineButton.addEventListener("click", async () => {
  const selectedProducts = products
    .filter((product) => selectedProductIds.has(product.id))
    .map(({ name, brand, category, description }) => ({
      name,
      brand,
      category,
      description,
    }));

  if (selectedProducts.length === 0) {
    chatStatus.textContent = "Choose at least one product to generate a routine.";
    return;
  }

  const apiContent = `Create a personalized routine using only these selected products. Here is their product data as JSON:\n${JSON.stringify(selectedProducts, null, 2)}`;
  await sendToWorker(
    apiContent,
    "Build a routine using my selected products.",
    () => {
      hasGeneratedRoutine = true;
      sendButton.disabled = false;
      userInput.placeholder = "Ask a follow-up about your routine…";
    }
  );
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = userInput.value.trim();

  if (!question) {
    return;
  }
  if (!hasGeneratedRoutine) {
    chatStatus.textContent = "Generate a routine first, then ask your follow-up question.";
    return;
  }

  const sent = await sendToWorker(question, question);
  if (sent) {
    userInput.value = "";
  }
});

initialize();
