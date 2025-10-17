# Inform users of model download

## Inform users of model download

![Thomas Steiner](https://web.dev/images/authors/thomassteiner.jpg)

Published: October 1, 2025

Before any of the [built-in AI](/docs/ai/built-in) APIs can be used, the underlying model and any customizations (such as fine-tunings) must be downloaded from the network, the compressed data be extracted, and finally be loaded into memory. This guide documents some of the best practices for improving the user experience as they wait for this download.

Every built-in AI API has the `create()` function to start a session. The `create()` function has a `monitor` option so you can [access download progress](/docs/ai/prompt-api#model_download) to share it with the user.

While built-in AI APIs are [built for client-side AI](/docs/ai/client-side), where data is processed in the browser and on the user's device, some applications can allow for data to be processed on a server. How you address your user in the model download progress is dependent on that question: does the data processing _have_ to be run locally only or not? If this is true, your application is client-side only. If not, your application could use a [hybrid implementation](#hybrid_implementation).

### Client-side only

In some scenarios, client-side data processing is required. For example, a healthcare application that allows for patients to ask questions about their personal information likely wants that information to remain private to the user's device. The user has to wait until the model and all customizations are downloaded and ready before they can use any data processing features.

In this case, if the model isn't already available, you should expose download progress information to the user.

```
<style>
  progress[hidden] ~ label {
    display: none;
  }
</style>

<button type="button">Create LanguageModel session</button>
<progress hidden id="progress" value="0"></progress>
<label for="progress">Model download progress</label>
```

![While the built-in model is downloading, the app can't be used yet.](/static/docs/ai/inform-users-of-model-download/languagemodel-without-cloud-fallback.png)

Now to make this functional, a bit of JavaScript is required. The code first resets the progress interface to the initial state (progress hidden and zero), checks if the API is supported at all, and then [checks the API's availability](/docs/ai/get-started#model_download):

-   The API is `'unavailable'`: Your application cannot be used client-side on this device. Alert the user that the feature is unavailable.
-   The API is `'available'`: The API can be used immediately, no need to show the progress UI.
-   The API is `'downloadable'` or `'downloading'`: The API can be used once the download is complete. Show a progress indicator and update it whenever the `downloadprogress` event fires. After the download, show the indeterminate state to signal to the user that the browser is getting the model extracted and loaded into memory.

```
const createButton = document.querySelector('.create');
const promptButton = document.querySelector('.prompt');
const progress = document.querySelector('progress');
const output = document.querySelector('output');

let sessionCreationTriggered = false;
let localSession = null;

const createSession = async (options = {}) => {
  if (sessionCreationTriggered) {
    return;
  }

  progress.hidden = true;
  progress.value = 0;

  try {
    if (!('LanguageModel' in self)) {
      throw new Error('LanguageModel is not supported.');
    }

    const availability = await LanguageModel.availability();
    if (availability === 'unavailable') {
      throw new Error('LanguageModel is not available.');
    }

    let modelNewlyDownloaded = false;
    if (availability !== 'available') {
      modelNewlyDownloaded = true;
      progress.hidden = false;
    }
    console.log(`LanguageModel is ${availability}.`);
    sessionCreationTriggered = true;

    const llmSession = await LanguageModel.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          progress.value = e.loaded;
          if (modelNewlyDownloaded && e.loaded === 1) {
            // The model was newly downloaded and needs to be extracted
            // and loaded into memory, so show the undetermined state.
            progress.removeAttribute('value');
          }
        });
      },
      ...options,
    });

    sessionCreationTriggered = false;
    return llmSession;
  } catch (error) {
    throw error;
  } finally {
    progress.hidden = true;
    progress.value = 0;
  }
};

createButton.addEventListener('click', async () => {
  try {
    localSession = await createSession({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    promptButton.disabled = false;
  } catch (error) {
    output.textContent = error.message;
  }
});

promptButton.addEventListener('click', async () => {
  output.innerHTML = '';
  try {
    const stream = localSession.promptStreaming('Write me a poem');
    for await (const chunk of stream) {
      output.append(chunk);
    }
  } catch (err) {
    output.textContent = err.message;
  }
});
```

If the user enters the app while the model is actively downloading to the browser, the progress interface indicates where the browser is in the download process based on the _still missing_ data.

### Client-side demo

Take a look at the [demo](https://googlechrome.github.io/samples/downloading-built-in-models/index.html) that shows this flow in action. If the built-in AI API (in this example, the Prompt API) isn't available, the app can't be used. If the built-in AI model still needs to be downloaded, a progress indicator is shown to the user. You can see the [source code](https://github.com/GoogleChrome/samples/tree/gh-pages/downloading-built-in-models) on GitHub.

### Hybrid implementation

If you prefer to use client-side AI, but can temporarily send data to the cloud, you can set up a hybrid implementation. This means users can experience features immediately, while in parallel downloading the local model. Once the model is downloaded, dynamically switch to the local session.

You can use any server-side implementation for hybrid, but it's probably best to stick with the same model family in both the cloud and locally to ensure you get comparable result quality. [Getting started with the Gemini API and Web apps](https://developers.google.com/learn/pathways/solution-ai-gemini-getting-started-web) highlights the various approaches for the Gemini API.

![While the built-in model is downloading, the app falls back to a cloud
model and is already usable.](/static/docs/ai/inform-users-of-model-download/languagemodel-with-cloud-fallback.png)

### Hybrid demo

The [demo](https://googlechrome.github.io/samples/downloading-built-in-models/gemini.html) shows this flow in action. If the built-in AI API isn't available, the demo falls back to the Gemini API in the cloud. If the built-in model still needs to be downloaded, a progress indicator is shown to the user and the app uses the Gemini API in the cloud until the model is downloaded. Take a look at the [full source code on GitHub](https://github.com/GoogleChrome/samples/tree/gh-pages/downloading-built-in-models).

## Conclusion

What category does your app fall into? Do you require 100% client-side processing or can you use a hybrid approach? After you've answered this question, the next step is to implement the model download strategy that works best for you.

Be sure your users always know when and if they can use your app client-side yet by showing them model download progress as outlined in this guide.

Remember that this isn't just a one-time challenge: if the browser purges the model due to storage pressure or when a new model version becomes available, the browser needs to download the model again. Whether you follow either the client-side or hybrid approach, you can be sure that you build the best possible experience for your users, and let the browser handle the rest.

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-10-01 UTC.