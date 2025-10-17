# Scale client-side summarization in small context windows

## Scale client-side summarization in small context windows

![André Cipriani Bandarra](https://web.dev/images/authors/andreban.jpg)

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

Published: March 12, 2025, Last updated: May 28, 2025

Explainer

Web

Extensions

Chrome Status

Intent

[MDN](https://developer.mozilla.org/docs/Web/API/Summarizer/)

![](/static/images/chrome_logo.svg) Chrome 138

![](/static/images/chrome_logo.svg) Chrome 138

[View](https://chromestatus.com/feature/5193953788559360)

[Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/cpyB56aHWs4/m/8NTdmGV8AAAJ)

The [Summarizer API](/docs/ai/summarizer-api) helps you generate summaries of information in various lengths and formats. Use it with Gemini Nano in Chrome, or other language models built into browsers, to concisely explain long or complicated text.

When performed client-side, you can work with data locally, which lets you keep sensitive data safe and can offer availability at scale. However, the context window is much smaller than with server-side models, which means very large documents could be challenging to summarize. To solve this problem, you can use the _summary of summaries_ technique.

## What is summary of summaries?

To use the _summary of summaries_ technique, split the input content at key points, then summarize each part independently. You can concatenate the outputs from each part, then summarize this concatenated text into one final summary.

![](/static/docs/ai/scale-summarization/images/summary-summaries.jpg)

For example, if a document is split in three parts, each part is summarized. Those three summaries are put together and summarized again for the final result.

### Thoughtfully split your content

It's important to consider how you'll split up a large piece of text, as different strategies can lead to different outputs across LLMs. Ideally, text should be split when there's a change of topic, such as a new section of an article or at a paragraph. It's important to avoid splitting the text in the middle of a word or sentence, which means you cannot use a character count as your only split guideline.

There are many ways you can do this. In the following example, we used the [Recursive Text Splitter](https://js.langchain.com/docs/how_to/recursive_text_splitter/) from [LangChain.js](http://LangChain.js), which balances performance and output quality. This should work for most workloads.

When creating a new instance, there are two key parameters:

-   `chunkSize` is the maximum number of characters allowed in each split.
-   `chunkOverlap` is the amount of characters to overlap between two consecutive splits. This ensures that each chunk has some of the context from the previous chunk.

Split the text with `splitText()` to return an array of strings with each chunk.

Most LLMs have their context window expressed as a number of tokens, rather than a number of characters. On average, a token contains 4 characters. In our example, the `chunkSize` is 3000 characters and that's approximately 750 tokens.

### Determine token availability

To determine how many tokens are available to use for an input, use the [`measureInputUsage()`](https://developer.mozilla.org/docs/Web/API/Summarizer/measureInputUsage) method and [`inputQuota`](https://developer.mozilla.org/docs/Web/API/Summarizer/inputQuota) property. In this case, the implementation is limitless, as you cannot know how many times the summarizer will run to process all of the text.

### Generate summaries for each split

Once you've set up how the content is split, you can generate summaries for each part with the Summarizer API.

Create an instance of the summarizer with the [`create()` function](https://developer.mozilla.org/docs/Web/API/Summarizer/create_static). To keep as much context as possible, we've set the `format` parameter to `plain-text`, `type` to [`tldr`](https://en.wikipedia.org/wiki/Wikipedia:Too_long;_didn%27t_read), and `length` to `long`.

Then, generate the summary for each split created by the `RecursiveCharacterTextSplitter` and concatenate the results into a new string. We separated each summary with a new line to clearly identify the summary for each part.

While this new line doesn't matter when executing this loop just once, it's useful for determining how each summary adds to the token value for the final summary. In most cases, this solution should work for medium and long content.

## Recursive summary of summaries

When you've got an exceedingly long amount of text, the length of the concatenated summary may be larger than the available context window, thus causing the summarization to fail. To address this, you can recursively summarize the summaries.

![](/static/docs/ai/scale-summarization/images/summary-squared.png)

If your summary of summaries is still too long, you can repeat the process. You could, in theory, repeat the process indefinitely, until you receive an appropriate length.

We still collect the initial splits generated by `RecursiveCharacterTextSplitter`. Then, in the `recursiveSummarizer()` function, we loop the summarization process based on the character length of the concatenated splits. If the character length of the summaries exceeds `3000`, then we concatenate into `fullSummaries`. If the limit isn't reached, the summary is saved as `partialSummaries`.

Once all of the summaries are generated, the final partial summaries are added to the full summary. If there's just 1 summary in `fullSummaries`, no additional recursion is needed. The function returns a final summary. If there's more than one summary present, the function repeats and continues summarizing the partial summaries.

We tested this solution with [Internet Relay Chat (IRC) RFC](https://www.rfc-editor.org/rfc/rfc1459.txt), which has a whopping 110,030 characters that include 17,560 words. The Summarizer API provided the following summary:

_Internet Relay Chat (IRC) is a way to communicate online in real-time using text messages. You can chat in channels or send private messages, and you can use commands to control the chat and interact with the server. It's like a chat room on the internet where you can type and see others' messages instantly._

That's pretty effective! And, it's only 309 characters.

### Limitations

The summary of summaries technique helps you operate within a client-size model's context window. Though there are many [benefits for client-side AI](/docs/ai/client-side), you may encounter the following:

-   **Less accurate summaries**: With recursion, the summary process repetition is possibly infinite, and each summary is farther from the original text. This means the model may generate a final summary that is too shallow to be useful.
-   **Slower performance**: Each summary takes time to generate. Again, with an infinite possible number of summaries in larger texts, this approach may take several minutes to finish.

We have a [summarizer demo available](https://chrome.dev/web-ai-demos/summary-of-summaries/), and you can view the [full source code](https://github.com/GoogleChromeLabs/web-ai-demos/blob/main/summary-of-summaries/src/main.ts).

Try to use the summary of summaries technique with different lengths of input text, different split sizes, and different overlap lengths, with the [Summarizer API](/docs/ai/summarizer-api).

-   For feedback on Chrome's implementation, file a [bug report](https://issues.chromium.org/issues/new?component=1617227&priority=P2&type=bug&template=0&noWizard=true) or a [feature request](https://issues.chromium.org/issues/new?component=1617227&priority=P2&type=feature_request&template=0&noWizard=true).
-   Read the [documentation on MDN](https://developer.mozilla.org/docs/Web/API/Summarizer/)
-   Chat with the [Chrome AI team](/docs/ai/team) about your summarization process or any other built-in AI questions.

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-05-28 UTC.