# Rewriter API

## Rewriter API

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

![Thomas Steiner](https://web.dev/images/authors/thomassteiner.jpg)

Published: May 20, 2025

Explainer

Web

Extensions

Chrome Status

Intent

[GitHub](https://github.com/explainers-by-googlers/writing-assistance-apis/)

![Origin trial](/static/images/experiment.svg) [Origin trial](https://developer.chrome.com/origintrials/#/view_trial/444167513249415169)

![Origin trial](/static/images/experiment.svg) [Origin trial](https://developer.chrome.com/origintrials/#/view_trial/444167513249415169)

[View](https://chromestatus.com/feature/5112320150470656)

[Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/LgPGLOV2vrc/m/1crxL0oPDwAJ)

The Rewriter API helps you revise and restructure text. This API and the [Writer API](/docs/ai/writer-api) are part of the [Writing Assistance APIs proposal](https://github.com/explainers-by-googlers/writing-assistance-apis/).

These APIs can help you improve content created by users.

### Use cases

Refine existing text by making it longer or shorter, or changing the tone. For example, you could:

-   Rewrite a short email so that it sounds more polite and formal.
-   Suggest edits to customer reviews to help other customers understand the feedback or remove toxicity.
-   Format content to meet the expectations of certain audiences.

Is your use case missing? Join the [early preview program](/docs/ai/join-epp) to share your feedback.

## Get started

[Join the Rewriter API origin trial](/origintrials#/view_trial/444167513249415169), running in Chrome 137 to 142.

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

### Sign up for the origin trial

The Rewriter API is available in a joint origin trial with the Writer API. To start using these APIs:

1.  Acknowledge [Google's Generative AI Prohibited Uses Policy](https://policies.google.com/terms/generative-ai/use-policy).
2.  Go to the [Rewriter API origin trial](/origintrials#/view_trial/444167513249415169).
3.  Click **Register** and fill out the form. In the Web origin field, provide your [origin](https://web.dev/articles/same-site-same-origin#origin) or extension ID, `chrome-extension://YOUR_EXTENSION_ID`.
4.  To submit, click **Register**.
5.  Copy the token provided, and add it to every participating web page on your origin or include it [in your Extension manifest](/docs/web-platform/origin-trials#extensions).
6.  Start using the Rewriter API.

Learn more about how to [get started with origin trials](/docs/web-platform/origin-trials).

### Add support to localhost

To access the Writer and Rewriter APIs on localhost during the origin trial, you must [update Chrome](https://support.google.com/chrome/answer/95414) to the latest version. Then, follow these steps:

1.  Go to `chrome://flags/#rewriter-api-for-gemini-nano`.
2.  Select **Enabled**.
3.  Click **Relaunch** or restart Chrome.

## Use the Rewriter API

First, run feature detection to see if the browser supports these APIs.

```
if ('Rewriter' in self) {
  // The Rewriter API is supported.
}
```

The Rewriter API, and all other built-in AI APIs, are integrated in the browser. Gemini Nano is downloaded separately the first time any website uses a built-in AI API. In practice, if a user has already interacted with a built-in API, they have downloaded the model to their browser.

To determine if the model is ready to use, call the asynchronous [`Rewriter.availability()`](/docs/ai/get-started#model-download) function. If the response to `availability()` was `downloadable`, listen for download progress and inform the user, as the download may take time.

```
const availability = await Rewriter.availability();
```

To trigger model download and start the rewriter, check for [user activation](/docs/ai/get-started#user-activation) and call the `Rewriter.create()` function.

```
const rewriter = await Rewriter.create({
  monitor(m) {
    m.addEventListener("downloadprogress", e => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  }
});
```

### API functions

The `create()` function lets you configure a new rewriter object. It takes an optional `options` object with the following parameters:

-   `tone`: [Writing tone](https://owl.purdue.edu/owl/multilingual/multilingual_students/key_concepts_for_writing_in_north_american_colleges/style_genre_and_writing.html) can refer to the style, character, or attitude of the content. The value can be set to `more-formal`, `as-is` (default), or `more-casual`.
-   `format`: The output formatting, with the allowed values `as-is` (default), `markdown`, and `plain-text`.
-   `length`: The length of the output, with the allowed values `shorter`, `as-is` (default), and `longer`.
-   `sharedContext`: When rewriting [multiple pieces of content](#multiple-tasks), a shared context can help the model create content better aligned with your expectations.

The following example demonstrates how to initiate a `rewriter` object:

```
const options = {
  sharedContext: 'This is an email to acquaintances about an upcoming event.',
  tone: 'more-casual',
  format: 'plain-text',
  length: 'shorter',
};

const available = await Rewriter.availability();
let rewriter;
if (available === 'unavailable') {
  // The Rewriter API isn't usable.
  return;
}
if (available === 'available') {
  // The Rewriter API can be used immediately .
  rewriter = await Rewriter.create(options);
} else {
  // The Rewriter can be used after the model is downloaded.
  rewriter = await Rewriter.create(options);
  rewriter.addEventListener('downloadprogress', (e) => {
    console.log(e.loaded, e.total);
  });
}
```

### Start rewriting

There are two ways to output content from the model: non-streaming and streaming.

#### Non-streaming output

With non-streaming rewriting, the model processes the input as a whole and then produces the output.

To get a non-streaming output, call the asynchronous `rewrite()` function. You must include the initial text that you want to be rewritten. You can add an optional `context` to provide the model background information, which may help the model better meet your expectations for the output.

```
// Non-streaming
const rewriter = await Rewriter.create({
  sharedContext: "A review for the Flux Capacitor 3000 from TimeMachines Inc."
});
const result = await rewriter.rewrite(reviewEl.textContent, {
  context: "Avoid any toxic language and be as constructive as possible."
});
```

#### Stream rewriting output

[Streaming](/docs/ai/streaming) offers results in real-time. The output updates continuously as the input is added and adjusted.

To get a streaming rewriter, call the `rewriteStreaming()` function and iterate over the available segments of text in the stream. You can add an optional `context` to provide the model background information, which may help the model better meet your expectations for the output.

```
const rewriter = await Rewriter.create({
  sharedContext: "A review for the Flux Capacitor 3000 from TimeMachines Inc."
});

const stream = rewriter.rewriteStreaming(reviewEl.textContent, {
  context: "Avoid any toxic language and be as constructive as possible.",
  tone: "more-casual",
});

for await (const chunk of stream) {
  composeTextbox.append(chunk);
}
```

You may want to use a `rewriter` to generate multiple pieces of content. In this case, it's useful to add `sharedContext`. For example, you may want to help reviewers give better feedback in comments.

```
// Shared context and per writing task context
const rewriter = await Rewriter.create({
  sharedContext: "This is for publishing on [popular website name], a business and employment-focused social media platform."
});

const stream = rewriter.rewriteStreaming(
  "Love all this work on generative AI at Google! So much to learn and so many new things I can do!",
  {
    context: "The request comes from someone working at a startup providing an e-commerce CMS solution.",
    tone: "more-casual",
  }
);

for await (const chunk of stream) {
  composeTextbox.append(chunk);
}
```

#### Reuse a rewriter

You can use the same rewriter to edit multiple pieces of content. This may be particularly useful if adding the rewriter to a feedback or commenting tool, to help writers offer productive and helpful feedback.

```
// Reusing a rewriter
const rewriter = await Rewriter.create({
  sharedContext: "A review for the Flux Capacitor 3000 from TimeMachines Inc."
});

const rewrittenReviews = await Promise.all(
  Array.from(
    document.querySelectorAll("#reviews > .review"),
    (reviewEl) => rewriter.rewrite(reviewEl.textContent, {
      context: "Avoid any toxic language and be as constructive as possible.",
      tone: "more-casual",
    })
  ),
);
```

#### Stop the rewriter

To end the rewriting process, abort the controller and destroy the `rewriter`.

```
// Stop a rewriter
const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const rewriter = await Rewriter.create({ signal: controller.signal });
await rewriter.rewrite(reviewEl.textContent, { signal: controller.signal });

// Destroy a rewriter
rewriter.destroy();
```

## Demo

## Permission Policy, iframes, and Web Workers

By default, the Rewriter API is only available to top-level windows and to their same-origin iframes. Access to the API can be delegated to cross-origin iframes using the Permission Policy `allow=""` attribute:

```
<!--
  The hosting site at https://main.example.com can grant a cross-origin iframe
  at https://cross-origin.example.com/ access to the Rewriter API by
  setting the `allow="rewriter"` attribute.
-->
<iframe src="https://cross-origin.example.com/" allow="rewriter"></iframe>
```

The Rewriter API isn't available in Web Workers. This is due to the complexity of establishing a responsible document for each worker, in order to check the Permissions Policy status.

The Writer and Rewriter APIs are under active discussion and subject to change in the future. If you try this API and have feedback, we'd love to hear it.

-   [Read the explainer](https://github.com/explainers-by-googlers/writing-assistance-apis/), raise questions and participate in discussion.
-   Review the implementation for Chrome on [Chrome Status](https://chromestatus.com/feature/5112320150470656).
-   [Join the early preview program](/docs/ai/join-epp) for an early look at new APIs and access to our mailing list.
-   If you have feedback on Chrome's implementation, file a [Chromium bug](https://new.crbug.com/).

Discover all of the [built-in AI APIs](/docs/ai/built-in-apis) which use models, including [Gemini Nano](https://deepmind.google/technologies/gemini/nano/) and other expert models, in the browser.

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-05-20 UTC.