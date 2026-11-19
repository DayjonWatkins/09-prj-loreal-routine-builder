# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Run the project

Open the project through a local web server so the page can load `products.json`.
Choose a category to browse products, click products to add or remove them, then
select **Generate my routine**. Selected product IDs are saved in this browser,
and **Clear all** removes the saved selections.

The chat sends selected product details and the conversation history to the
class Cloudflare Worker configured in `script.js`. The Worker returns the AI
reply; no API key is needed or stored in this project. After generating a
routine, use the chat box to ask beauty-related follow-up questions.