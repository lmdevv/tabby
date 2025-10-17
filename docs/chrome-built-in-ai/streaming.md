# How LLMs stream responses

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

## How LLMs stream responses

![Thomas Steiner](https://web.dev/images/authors/thomassteiner.jpg)

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

Published: January 21, 2025

A streamed LLM response consists of data emitted incrementally and continuously. Streaming data looks different from the server and the client.

## From the server

To understand what a streamed response looks like, I prompted Gemini to tell me a long joke using the command line tool [`curl`](https://curl.se/). Consider the following call to the Gemini API. If you try it, be sure to replace `{GOOGLE_API_KEY}` in the URL with your Gemini API key.

```
$ curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key={GOOGLE_API_KEY}" \
      -H 'Content-Type: application/json' \
      --no-buffer \
      -d '{ "contents":[{"parts":[{"text": "Tell me a long T-rex joke, please."}]}]}'
```

This request logs the following (truncated) output, in [event stream format](https://developer.mozilla.org/docs/Web/API/Server-sent_events/Using_server-sent_events#data-only_messages). Each line begins with `data:` followed by the message payload. The concrete format is not actually important, what matters are the chunks of text.

```
//
data: {"candidates":[{"content": {"parts": [{"text": "A T-Rex"}],"role": "model"},
  "finishReason": "STOP","index": 0,"safetyRatings": [{"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT","probability": "NEGLIGIBLE"},{"category": "HARM_CATEGORY_HATE_SPEECH","probability": "NEGLIGIBLE"},{"category": "HARM_CATEGORY_HARASSMENT","probability": "NEGLIGIBLE"},{"category": "HARM_CATEGORY_DANGEROUS_CONTENT","probability": "NEGLIGIBLE"}]}],
  "usageMetadata": {"promptTokenCount": 11,"candidatesTokenCount": 4,"totalTokenCount": 15}}

data: {"candidates": [{"content": {"parts": [{ "text": " walks into a bar and orders a drink. As he sits there, he notices a" }], "role": "model"},
  "finishReason": "STOP","index": 0,"safetyRatings": [{"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT","probability": "NEGLIGIBLE"},{"category": "HARM_CATEGORY_HATE_SPEECH","probability": "NEGLIGIBLE"},{"category": "HARM_CATEGORY_HARASSMENT","probability": "NEGLIGIBLE"},{"category": "HARM_CATEGORY_DANGEROUS_CONTENT","probability": "NEGLIGIBLE"}]}],
  "usageMetadata": {"promptTokenCount": 11,"candidatesTokenCount": 21,"totalTokenCount": 32}}
```

After executing the command, the result chunks stream in.

The first payload is JSON. Take a closer look at the highlighted `candidates[0].content.parts[0].text`:

```
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "A T-Rex"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HATE_SPEECH",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 11,
    "candidatesTokenCount": 4,
    "totalTokenCount": 15
  }
}
```

That first `text` entry is the beginning of Gemini's response. When you extract more `text` entries, the response is newline-delimited.

The following snippet shows multiple `text` entries, which shows the final response from the model.

```
"A T-Rex"

" was walking through the prehistoric jungle when he came across a group of Triceratops. "

"\n\n\"Hey, Triceratops!\" the T-Rex roared. \"What are"

" you guys doing?\"\n\nThe Triceratops, a bit nervous, mumbled,
\"Just... just hanging out, you know? Relaxing.\"\n\n\"Well, you"

" guys look pretty relaxed,\" the T-Rex said, eyeing them with a sly grin.
\"Maybe you could give me a hand with something.\"\n\n\"A hand?\""

...
```

But what happens if instead of for T-rex jokes, you ask the model for something slightly more complex. For example, ask Gemini to come up with a JavaScript function to determine if a number is even or odd. The `text:` chunks look slightly different.

The output now contains [Markdown](https://spec.commonmark.org/current/) format, starting with the JavaScript code block. The following sample includes the same pre-processing steps as before.

```
"```javascript\nfunction"

" isEven(number) {\n  // Check if the number is an integer.\n"

"  if (Number.isInteger(number)) {\n  // Use the modulo operator"

" (%) to check if the remainder after dividing by 2 is 0.\n  return number % 2 === 0; \n  } else {\n  "
"// Return false if the number is not an integer.\n    return false;\n }\n}\n\n// Example usage:\nconsole.log(isEven("

"4)); // Output: true\nconsole.log(isEven(7)); // Output: false\nconsole.log(isEven(3.5)); // Output: false\n```\n\n**Explanation:**\n\n1. **`isEven("

"number)` function:**\n   - Takes a single argument `number` representing the number to be checked.\n   - Checks if the `number` is an integer using `Number.isInteger()`.\n   - If it's an"

...
```

To make matters more challenging, some of the marked up items begin in one chunk and end in another. Some of the markup is nested. In the following example, the highlighted function is split between two lines: `**isEven(` and `number) function:**`. Combined, the output is `**isEven("number) function:**`. This means if you want to output formatted Markdown, you can't just process each chunk individually with a Markdown parser.

## From the client

If you run models like [Gemma](https://ai.google.dev/gemma) on the client with a framework like [MediaPipe LLM](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference), streaming data comes through a callback function.

For example:

```
llmInference.generateResponse(
  inputPrompt,
  (chunk, done) => {
     console.log(chunk);
});
```

With the [Prompt API](https://github.com/webmachinelearning/prompt-api), you get streaming data as chunks by iterating over a [`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream).

```
const languageModel = await LanguageModel.create();
const stream = languageModel.promptStreaming(inputPrompt);
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Next steps

Are you wondering how to performantly and securely render streamed data? Read our [best practices to render LLM responses](/docs/ai/render-llm-responses).

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-01-21 UTC.