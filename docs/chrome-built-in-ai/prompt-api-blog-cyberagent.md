# Empowering bloggers: How CyberAgent deployed built-in AI to enhance content creation  |  Blog  |  Chrome for Developers

![Yuriko Hirota](https://web.dev/images/authors/yuriko-hirota.jpg)

![Kazunari Hara](https://web.dev/images/authors/kazunarihara.jpg)

Published: April 28, 2025, Last updated: May 21, 2025

![](/static/blog/prompt-api-blog-cyberagent/images/ameba.png)

The rapid evolution of AI is opening up new frontiers for web applications, particularly with the advent of on-device capabilities. Discover how CyberAgent, a leading Japanese internet company, is using Chrome's [built-in AI](/docs/ai/built-in) and the Prompt API to enhance the blogging experience on their platform, [Ameba Blog](https://ameblo.jp/).

We share their goals, the benefits of working with built-in AI, challenges they faced, and valuable insights for other developers using built-in AI.

## What is the Prompt API?

Explainer

Web

Extensions

Chrome Status

Intent

[GitHub](https://github.com/webmachinelearning/prompt-api)

![Origin trial](/static/images/experiment.svg) [Origin trial](https://developer.chrome.com/origintrials/#/view_trial/2533837740349325313)

![](/static/images/chrome_logo.svg) Chrome 138

[View](https://chromestatus.com/feature/5134603979063296)

[Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/6uBwiiFohAU/m/WhaKAB9fAAAJ)

The [Prompt API](/docs/extensions/ai/prompt-api) helps developers use a large language models to add AI features directly into their apps. By defining custom prompts, apps can perform tasks like data extraction, content generation, and personalized responses. In Chrome, the Prompt API performs client-side inference with [Gemini Nano](https://deepmind.google/technologies/gemini/nano/). This local processing, regardless of what model is used, enhances data privacy and speed of response. Whatever model is used, client response speed.

## AI assistance for Ameba Blog authors

CyberAgent recognized a common pain point for authors: the often time-consuming process of crafting compelling content, especially titles. They hypothesized that integrating AI-powered functions in the blog creation interface could significantly improve the quality and efficiency of content creation. Their goal was to provide tools that provide inspiration and help their bloggers create engaging content.

CyberAgent developed a Chrome Extension with the Prompt API. This extension provides a suite of AI-powered features designed to assist Ameba Blog writers generate titles and headings, subsequent paragraphs, and general copy improvements.

CyberAgent wanted flexibility of capabilities, which led straight to the Prompt API. With infinite possibilities in one API, CyberAgent was able to determine exactly what would work best and be most useful for the Ameba authors.

CyberAgent tested the extension with a select number of bloggers, which offered valuable insights for the practicality of the offered functions. The feedback helped CyberAgent identify better applications for AI assistance and refine the extension's design. Based on the positive results and feedback, CyberAgent is looking to release this feature in the future, bringing the power of client-side AI directly to their blogging community.

Let's take a closer look at these features.

### Write better titles and headings

The extension generates multiple title suggestions, based on the full blog content. Blog writers can further refine these suggestions, with options that include: "Regenerate," "More Polite," "More Casual," or "Generate Similar Titles," and more.

CyberAgent designed the UI specifically so that the users won't have to write any prompt. This way, any users who are unfamiliar with prompt engineering can also benefit from the power of AI.

Authors can regenerate titles to be more formal, more casual, or regenerate with the same tone.

The extension can also generate compelling headers for individual sections of the blog, which authors can request by selecting the relevant text for a heading.

By selecting the text, authors can generate headings specific to that section.

The code to generate a title with the Prompt API includes an initial prompt and a user prompt. The initial prompt gives context and instructions to get a particular type of output, whereas the user prompts ask for the model to engage with what the user writes. Read more about their code in [Deploy AI assistance](#deploy_ai_assistance).

### Generate subsequent paragraphs

The extension helps bloggers conquer writer's block by generating subsequent paragraphs based on the selected text. With the context from the preceding paragraph, the AI drafts a continuation of the paragraph, allowing authors to maintain their creative flow.

The author can request for help writing the next paragraph, with the context from the previous paragraph.

### Improve and edit the text

Gemini Nano analyzes the selected text and can suggest improvements. The users can regenerate the improvements with additional notes on tone and language choice to make the copy "cuter" or "simpler."

Generate an improved version of the selected text with the explanation on what the model has improved.

## Deploy AI assistance

CyberAgent broke their extension code into three steps: session creation, trigger, and model prompting.

First, they check with the browser that built-in AI is available and supported. If yes, they create a session with default parameters..

```
if (!LanguageModel) {
  // Detect the feature and display "Not Supported" message as needed
  return;
}
// Define default values for topK and temperature within the application
const DEFAULT_TOP_K = 3;
const DEFAULT_TEMPERATURE = 1;
let session = null;

async function createAISession({ initialPrompts, topK, temperature } = {}) {
  const { available, defaultTopK, maxTopK, defaultTemperature } =
    await LanguageModel.availability();
  // "readily", "after-download", or "no"
  if (available === "no") {
    return Promise.reject(new Error('AI not available'));
  }
  const params = {
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', event => {
        console.log(`Downloaded: ${event.loaded} of ${event.total} bytes.`);
      });
    },
    initialPrompts: initialPrompts || '',
    topK: topK || defaultTopK,
    temperature: temperature || defaultTemperature,
  };
  session = await LanguageModel.create(params);
  return session;
}
```

Each feature has a helper function triggered by the user. Once triggered, when the user clicks the relevant button, they update the session accordingly.

```
async function updateSession({ initialPrompts, topK, temperature } = {
  topK: DEFAULT_TOP_K,
  temperature: DEFAULT_TEMPERATURE,
}) {
  if (session) {
    session.destroy();
    session = null;
  }
  session = await createAISession({
    initialPrompts,
    topK,
    temperature,
  });
}
```

After the session is updated, they prompt the model according to the function. For example, here's the code to generate a title and regenerate a title with a more formal tone.

```
async function generateTitle() {
    // Initialize the model session
    await updateSession({
      initialPrompts: [
        { role: 'system', 
          content: `Create 3 titles suitable for the blog post's content,
          within 128 characters, and respond in JSON array format.`,
        }
      ]
    });
    const prompt = `Create a title for the following
    blog post.${textareaEl.textContent}`;
    const result = await session.prompt(prompt);
    try {
      const fixedJson = fixJSON(result);
      // display result
      displayResult(fixedJSON);
    } catch (error) {
      // display error
      displayError();
    }
  }
  async function generateMoreFormalTitle() {
    // Do not execute updateSession to reuse the session during regeneration
    const prompt = 'Create a more formal title.';
    const result = await session.prompt(prompt);
    ...
 }
```

## The benefits of built-in AI

Built-in AI is a type of [client-side AI](/docs/ai/client-side), which means inference occurs on the user's device. CyberAgent chose to use built-in AI APIs with Gemini Nano because of the compelling advantages it offers to both application developers and users.

The key benefits CyberAgent focused on include:

-   Security and privacy
-   Cost
-   Responsiveness and reliability
-   Ease of development

### Security and privacy

The ability to run AI models directly on the user's device without transmitting data to external servers is paramount. Blog drafts aren't meant to be seen by the public, and thus, CyberAgent doesn't want to send these drafts to a third-party server.

Built-in AI downloads Gemini Nano to user devices, eliminating the need to send and receive data from servers. This is particularly useful when writing, as drafts may include confidential information or unintended expressions. Built-in AI keeps the original and generated content local instead of sending it to a server, which can enhance security and protect content privacy.

### Cost savings

One major advantage to using built-in AI is that the browser includes Gemini Nano and the APIs are free to use. There's no additional or hidden costs.

Built-in AI significantly reduces server costs and can fully remove the costs associated with AI inference. This solution could be quickly scalable to a large user base, and allows for users to submit consecutive prompts to refine outputs without incurring additional fees.

### Responsiveness and reliability

Built-in AI provides consistent and fast response times, independent of network conditions. This enabled the users to generate content over and over again, which makes it much easier for users to try new ideas and create a satisfying end result, quickly.

### Ease of development

Chrome's built-in AI simplifies the development process by providing a readily available API. Developers benefit from how easy it is to create AI-powered features for their application.

Gemini Nano and the built-in AI APIs are installed in Chrome, so there's no need for additional setup or model management. The APIs use JavaScript, like other browser APIs, and require no expertise in machine learning..

## Navigating challenges for better results

CyberAgent's journey with the Prompt API provided valuable lessons about the nuances of working with client-side LLMs.

-   **Inconsistent responses**: Like other LLMs, Gemini Nano doesn't guarantee identical outputs for the same prompt. CyberAgent encountered responses in unexpected formats (such as Markdown and invalid JSON). Even with instructions, it's possible the results vary greatly. When implementing any application or Chrome Extension with built-in AI, it may be beneficial to add a workaround to ensure the output is always in the correct format.

-   **Token limit**: Managing token usage is crucial. CyberAgent used properties and methods like `inputUsage`, `inputQuota`, and `measureInputUsage()` to [manage sessions](/docs/ai/session-management), maintain context, and reduce token consumption. This was especially important when refining titles.
-   **Model size constraints**: As the model is downloaded and lives on the user's device, it's significantly smaller than a server-based model. This means it's critical to provide sufficient context within the prompt to achieve satisfactory results, especially for summarization. Learn more about [understanding LLM sizes](https://web.dev/articles/llm-sizes).

CyberAgent emphasizes that while client-side models aren't universally available across all browsers and devices yet, and the smaller models have limitations, it can still deliver impressive performance for specific tasks. The ability to iterate quickly and experiment without server-side costs makes it a valuable tool.

They advise finding a balance, recognizing that perfect responses are difficult to achieve with any AI, whether server-side or client-side. Finally, they see a future where a hybrid approach, combining the strengths of both server-side and client-side AI, will unlock even greater potential.

## Looking ahead

CyberAgent's exploration of built-in AI showcases the exciting possibilities of seamless AI integrations to enhance user experiences. Their extension built to work with Ameba Blog demonstrates how these technologies can be practically applied to solve real-world problems, offering valuable lessons for the broader web development community.

As the technology matures and support for browsers and devices expands, we expect to see even more innovative applications of built-in AI and other forms of client-side AI.

## Resources

-   [Learn more about Prompt API](/docs/ai/prompt-api)
-   [Start using Built-in APIs on Chrome](/docs/ai/built-in-apis)
-   [CyberAgent's case study on Web AI](https://developers.cyberagent.co.jp/blog/archives/53112/), which covers this same topic.
-   Watch [The future of AI is now](https://youtu.be/LFveSvTJh5U), CyberAgent's case studies on client-side AI

## Acknowledgements

Thank you to Ameba's bloggers, [ao](https://ameblo.jp/honeyhoneydip/), [Nodoka](https://ameblo.jp/momonodo/), [Erin](https://ameblo.jp/kurimama2013/), [Chiaki](https://ameblo.jp/chiachi10jyu/), and [socchi](https://ameblo.jp/socchidiary/), who provided feedback and helped better the extension. Thanks to [Thomas Steiner](/authors/thomas-steiner), [Alexandra Klepper](/authors/alexandra-klepper), and [Sebastian Benz](/authors/sebastian-benz) for their help writing and reviewing this blog post.