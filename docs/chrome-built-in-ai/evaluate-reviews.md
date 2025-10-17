# Evaluate product reviews with AI

## Evaluate product reviews with AI

![Maud Nalpas](https://web.dev/images/authors/maudn.jpg)

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

Published: May 16, 2024

When shopping online, it can be overwhelming to see the volume of product reviews and the volume of products available. How can we sort through all of this noise to find the product that will actually meet our specific needs?

For example, say we're shopping for a work backpack. Backpacks need to meet a balance in function, aesthetics, and practicality. The number of reviews makes it nearly impossible to know if you have found the perfect bag. What if we could use AI to sift through the noise and find the perfect product?

What would be helpful is a summary of all reviews, alongside a list of most common pros and cons.

![](/static/docs/ai/images/user-reviews.jpg)

An example user review with a star rating and a pros and cons list.

To build this, we use server-side generative AI. Inference occurs on a server.

In this document, you can follow along with a tutorial for the [Gemini API with Node.js](https://ai.google.dev/tutorials/get_started_node), using the Google AI JavaScript SDK to summarize data from many reviews. We focus on the generative AI portion of this work; we won't cover how to store results or create a job queue.

In practice, you could use any LLM API with any SDK. However, the suggested prompt may need to be adapted to meet the model you choose.

## Prerequisites

1.  Create a [key for the Gemini API](https://aistudio.google.com/app/apikey), and define it in your environment file.
    
2.  Install the Google AI JavaScript SDK, for example with npm: `npm install @google/generative-ai`
    

## Build a review summarizer application

1.  [Initialize a generative AI object](https://ai.google.dev/tutorials/get_started_node#initialize-model).
2.  Create a function to generate review summaries.
    1.  Select the generative AI model. For our use case, we'll use Gemini Pro. Use a model that's specific to your use case (for example, `gemini-pro-vision` is for multimodal input).
    2.  Add a prompt.
    3.  Call `generateContent` to pass the prompt as an argument.
    4.  Generate and return the response.

```
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access the API key env
const genAI = new GoogleGenerativeAI(process.env.API_KEY_GEMINI);

async function generateReviewSummary(reviews) {
  // Use gemini-pro model for text-only input
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  // Shortened for legibility. See "Write an effective prompt" for
  // writing an actual production-ready prompt.
  const prompt = `Summarize the following product reviews:\n\n${reviews}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const summary = response.text();
  return summary;
}
```

### Write an effective prompt

The best way to be successful with generative AI is to create a thorough prompt. In this example, we've used the _one-shot prompting_ technique to get consistent outputs.

One-shot prompting is represented by the example output for Gemini to model.

```
const prompt =
`I will give you user reviews for a product. Generate a short summary of the
reviews, with focus on the common positive and negative aspects across all of
the reviews. Use the exact same output format as in the example (list of
positive highlights, list of negative aspects, summary). In the summary,
address the potential buyer with second person ("you", "be aware").

Input (list of reviews):
// ... example

Output (summary of reviews):
// ... example

**Positive highlights**
// ... example
**Negative aspects**
// ... example
**Summary**
// ... example

Input (list of reviews):
${reviews}

Output (summary of all input reviews):`;
```

Here's an example output from this prompt, which includes a summary of all reviews, alongside a list of common pros and cons.

```
## Summary of Reviews:

**Positive highlights:**

* **Style:** Several reviewers appreciate the backpack's color and design.
* **Organization:** Some users love the compartments and find them useful for
  organization.
* **Travel & School:** The backpack seems suitable for both travel and school
  use, being lightweight and able to hold necessary items.

**Negative aspects:**

* **Durability:** Concerns regarding the zipper breaking and water bottle holder
  ripping raise questions about the backpack's overall durability.
* **Size:** A few reviewers found the backpack smaller than expected.
* **Material:** One user felt the material was cheap and expressed concern about
  its longevity.

**Summary:**

This backpack seems to be stylish and appreciated for its organization and
suitability for travel and school. However, you should be aware of potential
durability issues with the zippers and water bottle holder. Some users also
found the backpack smaller than anticipated and expressed concerns about the
material's quality.
```

### Token limits

Many reviews can hit the model's token limit. Tokens aren't always equal to a single word; a token can be parts of a word or multiple words together. For example, [Gemini Pro](https://ai.google.dev/models/gemini#model-variations) has a 30,720 token limit. This means the prompt can include, at-most, 600 average 30-word reviews in English, minus the rest of the prompt instructions.

Use [`countTokens()`](https://ai.google.dev/tutorials/get_started_web#count-tokens) to check the number of tokens and reduce the input if the prompt is larger than allowed.

```
const MAX_INPUT_TOKENS = 30720
const { totalTokens } = await model.countTokens(prompt);
if (totalTokens > MAX_INPUT_TOKENS) {
    // Shorten the prompt.
}
```

## Build for enterprise

If you're a Google Cloud user or otherwise need enterprise support, you can access Gemini Pro and more models, such as Anthropic's Claude models, with [Vertex AI](https://cloud.google.com/vertex-ai). You may want to use [Model Garden](https://cloud.google.com/model-garden) to determine which model best matches your specific use case.

## Next steps

The application we built relies heavily on quality reviews to give the most effective summaries. To collect those quality reviews, read the next article in this series is [Help users write useful product reviews with on-device web AI](/docs/ai/product-reviews-on-device).

We want to hear from you about this approach. Tell us what use cases most interest you. You can [share your feedback and join the Early Preview Program](/docs/ai/join-epp) to test this technology with local prototypes.

Your contribution can help us make AI a powerful, yet practical, tool for everyone.

[Next: Help users write useful product reviews](/docs/ai/product-reviews-on-device)

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2024-05-16 UTC.