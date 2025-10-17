# Summarize with built-in AI

[Skip to main content](#main-content)

-   [Docs](/docs)
    -   [AI](/docs/ai)
    -   [Built-in](/docs/ai/built-in)
    -   [WebGPU](/docs/web-platform/webgpu)
    -   [Extensions and AI](/docs/extensions/ai)
    -   [DevTools and AI](/docs/devtools/ai-assistance)
-   [Case studies](/case-studies)
-   [Blog](/blog)
-   [New in Chrome](/new)

-   Built-in AI
    
-   [What is built-in AI?](/docs/ai/built-in)
-   [Get started](/docs/ai/get-started)
-   [Benefits of client-side AI](/docs/ai/client-side)
-   [Join the EPP](/docs/ai/join-epp)
-   [Try the demos](https://chrome.dev/web-ai-demos/)
-   APIs
    
-   [API status and overview](/docs/ai/built-in-apis)
-   [Writer API](/docs/ai/writer-api)
-   [Rewriter API](/docs/ai/rewriter-api)
-   [Proofreader API](/docs/ai/proofreader-api)
-   [Prompt API](/docs/ai/prompt-api)
-   [Translator API](/docs/ai/translator-api)
-   [Language Detector API](/docs/ai/language-detection)
-   [Summarizer API](/docs/ai/summarizer-api)
-   Build with AI
    
-   [Summarize in small context windows](/docs/ai/scale-summarization)
-   Case studies
    
    -   [Enhance blogging with the Prompt API](/blog/prompt-api-blog-cyberagent)
    -   [Support multilingual experiences](/blog/pb-jiohotstar-translation-ai)
    -   [Create engaging article summaries](/blog/summarizer-terra-brightsites)
    -   [Create helpful user review summaries](/blog/summarizer-redbus-miravia)
    
-   [Translate on-device](/docs/ai/translate-on-device)

-   [Extensions and AI](/docs/extensions/ai)
-   [Hybrid AI prompting with Firebase AI Logic](/docs/ai/firebase-ai-logic)
-   Best practices
    

-   [Cache models](/docs/ai/cache-models)
-   [Stream LLM responses](/docs/ai/streaming)
-   [Render streamed LLM responses](/docs/ai/render-llm-responses)
-   [Debug Gemini Nano](/docs/ai/debug-gemini-nano)
-   [Inform users of model download](/docs/ai/inform-users-of-model-download)
-   Resources
    
-   [Meet the Chrome team](/docs/ai/team)
-   [Glossary and concepts](/docs/ai/glossary)
-   [Gemini API in Node.js](https://ai.google.dev/tutorials/get_started_node)
-   [Gemini API in web apps](https://ai.google.dev/tutorials/get_started_web)
-   [AI on Web.dev](https://web.dev/explore/ai)

## Summarize with built-in AI

![Thomas Steiner](https://web.dev/images/authors/thomassteiner.jpg)

Published: November 11, 2024, Last updated: July 30, 2025

You can offer your users the ability to distill lengthy articles, complex documents, or even lively chat conversations into concise and insightful summaries.

The Summarizer API can be used to generate different types of summaries in varied lengths and formats, such as sentences, paragraphs, bullet point lists, and more. We believe this API is useful in the following scenarios:

-   Summarizing the key points of an article or a chat conversation.
-   Suggesting titles and headings for articles.
-   Creating a concise and informative summary of a lengthy text.
-   Generating a teaser for a book based on a book review.

## Get started

The Summarizer API is available from [Chrome 138 stable](https://chromestatus.com/roadmap).

Before you use this API, acknowledge [Google's Generative AI Prohibited Uses Policy](https://policies.google.com/terms/generative-ai/use-policy).

Run feature detection to see if the browser supports the Summarizer API.

```
if ('Summarizer' in self) {
  // The Summarizer API is supported.
}
```

### Review the hardware requirements

The following requirements exist for developers and the users who operate features using these APIs in Chrome. Other browsers may have different operating requirements.

The Language Detector and Translator APIs work in Chrome on desktop. These APIs do not work on mobile devices. The Prompt API, Summarizer API, Writer API, Rewriter API, and Proofreader API work in Chrome when the following conditions are met:

-   **Operating system**: Windows 10 or 11; macOS 13+ (Ventura and onwards); Linux; or ChromeOS (from Platform 16389.0.0 and onwards) on [Chromebook Plus](https://www.google.com/chromebook/chromebookplus/) devices. Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported by the APIs which use Gemini Nano.
-   **Storage**: At least 22 GB of free space on the volume that contains your Chrome profile.
-   **GPU or CPU**: Built-in models can run with GPU or CPU.
    -   **GPU**: Strictly more than 4 GB of VRAM.
    -   **CPU**: 16 GB of RAM or more and 4 CPU cores or more.
-   **Network**: Unlimited data or an unmetered connection.

Gemini Nano's exact size may vary as the browser updates the model. To determine the current size, visit `chrome://on-device-internals`.

### Model download

The Summarizer API uses a model trained to generate high-quality summaries. The API is built into Chrome, and Gemini Nano is the model downloaded the first time a website uses this API.

To determine if the model is ready to use, call the asynchronous [`Summarizer.availability()`](/docs/ai/get-started#model-download) function. If the response to `availability()` is `downloadable`, listen for download progress to inform the user of its progress, as it may take time.

```
const availability = await Summarizer.availability();
```

To trigger the model download and create the summarizer, check for [user activation](/docs/ai/get-started#user-activation), then call the asynchronous `Summarizer.create()` function.

```
// Proceed to request batch or streaming summarization
const summarizer = await Summarizer.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  }
});
```

## API functions

The `create()` function lets you configure a new summarizer object to your needs. It takes an optional `options` object with the following parameters:

-   `sharedContext`: Additional shared context that can help the summarizer.
-   `type`: The type of the summarization, with the allowed values `key-points` (default), `tldr`, `teaser`, and `headline`. See the following table for details.
-   `format`: The format of the summarization, with the allowed values `markdown` (default) and `plain-text`.
-   `length`: The length of the summarization, with the allowed values `short`, `medium` (default), and `long`. The meanings of these lengths vary depending on the `type` requested. For example, in Chrome's implementation, a short key-points summary consists of three bullet points, and a short summary is one sentence.

Once set, the parameters can't be changed. Create a new summarizer object if you need to make modifications to the parameters.

The following table demonstrates the different types of summaries and their corresponding lengths. The lengths represent the maximum possible value, as sometimes, the results can be shorter.

Type

Meaning

Length

`"tldr"`

Summary should be short and to the point, providing a quick overview of the input, suitable for a busy reader.

short

1 sentence

medium

3 sentences

long

5 sentences

`"teaser"`

Summary should focus on the most interesting or intriguing parts of the input, designed to draw the reader in to read more.

short

1 sentence

medium

3 sentences

long

5 sentences

`"key-points"`

Summary should extract the most important points from the input, presented as a bulleted list.

short

3 bullet points

medium

5 bullet points

long

7 bullet points

`"headline"`

Summary should effectively contain the main point of the input in a single sentence, in the format of an article headline.

short

12 words

medium

17 words

long

22 words

For example, you could initialize a summarizer to output a medium length of key points in Markdown.

```
const options = {
  sharedContext: 'This is a scientific article',
  type: 'key-points',
  format: 'markdown',
  length: 'medium',
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  }
};

const availability = await Summarizer.availability();
if (availability === 'unavailable') {
  // The Summarizer API isn't usable.
  return;
}

// Check for user activation before creating the summarizer
if (navigator.userActivation.isActive) {
  const summarizer = await Summarizer.create(options);
}
```

There are two ways to run the summarizer: streaming and batch (non-streaming).

### Batch summarization

With batch summarization, the model processes the input as a whole and then produces the output.

To get a batch summary, call the `summarize()` function. The first argument is the text that you want to summarize. The second, optional argument is an object with a `context` field. This field lets you add background details that might improve the summarization.

```
const longText = document.querySelector('article').innerHTML;
const summary = await summarizer.summarize(longText, {
  context: 'This article is intended for a tech-savvy audience.',
});
```

### Streaming summarization

[Streaming](/docs/ai/streaming) summarization offers results in real-time. The output updates continuously as the input is added and adjusted. To get a streaming summary, call `summarizeStreaming()` instead of `summarize()`.

```
const longText = document.querySelector('article').innerHTML;
const stream = summarizer.summarizeStreaming(longText, {
  context: 'This article is intended for junior developers.',
});
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Demo

You can try the Summarizer API in the [Summarizer API Playground](https://chrome.dev/web-ai-demos/summarization-api-playground/).

## Permission Policy, iframes, and Web Workers

By default, the Summarizer API is only available to top-level windows and to their same-origin iframes. Access to the API can be delegated to cross-origin iframes using the Permission Policy `allow=""` attribute:

```
<!--
  The hosting site at https://main.example.com can grant a cross-origin iframe
  at https://cross-origin.example.com/ access to the Summarizer API by
  setting the `allow="summarizer"` attribute.
-->
<iframe src="https://cross-origin.example.com/" allow="summarizer"></iframe>
```

The Summarizer API isn't available in Web Workers for now. This is due to the complexity of establishing a responsible document for each worker, in order to check the Permissions Policy status.

We want to see what you're building with the Summarizer API. Share your websites and web applications with us on [X](https://x.com/ChromiumDev), [YouTube](https://www.youtube.com/user/ChromeDevelopers), and [LinkedIn](https://www.linkedin.com/showcase/chrome-for-developers/).

For feedback on Chrome's implementation, file a [bug report](https://issues.chromium.org/issues/new?component=1617227&priority=P2&type=bug&template=0&noWizard=true) or a [feature request](https://issues.chromium.org/issues/new?component=1617227&priority=P2&type=feature_request&template=0&noWizard=true).

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-07-30 UTC.