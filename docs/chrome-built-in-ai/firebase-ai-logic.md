# Hybrid AI prompting with Firebase AI Logic

## Hybrid AI prompting with Firebase AI Logic

![Thomas Steiner](https://web.dev/images/authors/thomassteiner.jpg)

Published: May 20, 2025

To meet your users' needs, whatever platform or hardware they use, you can set up a fallback to the cloud with Firebase AI Logic for the built-in [Prompt API](/docs/ai/prompt-api).

## Build a hybrid AI experience

[Built-in AI](/docs/ai/built-in) comes with a [number of benefits](/docs/ai/built-in#benefits-on-device), most notably:

-   **Local processing of sensitive data:** If you work with sensitive data, you can offer AI features to users with end-to-end encryption.
-   **Offline AI usage:** Your users can access AI features, even when they're offline or have lapsed connectivity

While these benefits don't apply to cloud applications, you can ensure a seamless experience for those who cannot access built-in AI.

## Get started with Firebase

1.  [Create a Firebase project](https://console.firebase.google.com/?_gl=1*wwzp3b*_ga*MTI4NTE3Mzg2Ny4xNzQ3MDUzNzYx*_ga_CW55HF8NVT*czE3NDcwNTM1NjgkbzEkZzEkdDE3NDcwNTM3NjEkajM1JGwwJGgw) and register your web application.
2.  Read the [Firebase JavaScript SDK documentation](https://firebase.google.com/docs/web/setup) to continue your web application setup.

Firebase projects create a Google Cloud project, with Firebase-specific configurations and services. Learn more about [Google Cloud and Firebase](https://firebase.google.com/docs/projects/learn-more#firebase-cloud-relationship).

### Install the SDK

This workflow uses npm and requires module bundlers or JavaScript framework tooling. Firebase AI Logic is optimized to work with module bundlers to eliminate unused code and decrease SDK size.

```
npm install firebase
```

Once installed, [initialize the Firebase in your application](https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference?api=dev#add-sdk).

Once Firebase is installed and initialized, choose either the Gemini Developer API or the Vertex AI Gemini API, then [initialize and create an instance](https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference?api=dev#initialize-service-and-model).

Once initialized, you can prompt the model with text or multimodal input.

#### Text prompts

You can use plain text for your instructions to the model. For example, you could ask the model to tell you a joke.

You have some options for how the request is routed:

-   Use the built-in AI by default when it's available by setting the `mode` to `'prefer_on_device'` in the `getGenerativeModel()` function. If the built-in model isn't available, the request will fall back seamlessly to use the cloud model (if you're online).
    
-   Use the cloud model by default when you're online by setting the `mode` to `'prefer_in_cloud'` in the `getGenerativeModel()` function. If you're offline, the request will fall back seamlessly to use the built-in AI when available.
    

```
// Initialize the Google AI service.
const googleAI = getAI(firebaseApp);

// Create a `GenerativeModel` instance with a model that supports your use case.
const model = getGenerativeModel(googleAI, { mode: 'prefer_on_device' });

const prompt = 'Tell me a joke';

const result = await model.generateContentStream(prompt);

for await (const chunk of result.stream) {
  const chunkText = chunk.text();
  console.log(chunkText);
}
console.log('Complete response', await result.response);
```

#### Multimodal prompts

You can also prompt with image or audio, in addition to text. You could tell the model to describe an image's contents or transcribe an audio file.

Images need to be passed as a base64-encoded string as a Firebase `FileDataPart` object, which you can do with the helper function `fileToGenerativePart()`.

```
// Converts a File object to a `FileDataPart` object.
// https://firebase.google.com/docs/reference/js/vertexai.filedatapart
async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  }

  const fileInputEl = document.querySelector('input[type=file]');

  fileInputEl.addEventListener('change', async () => {
    const prompt = 'Describe the contents of this image.';

    const imagePart = await fileToGenerativePart(fileInputEl.files[0]);

    // To generate text output, call generateContent with the text and image
    const result = await model.generateContentStream([prompt, imagePart]);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      console.log(chunkText);
    }
    console.log(Complete response: ', await result.response);
  });
```

## Demo

Visit the [Firebase AI Logic demo](https://chrome.dev/web-ai-demos/firebase-ai-logic/) on different devices and browsers. You can see how the model response comes from either the built-in AI model or the cloud.

When on supported hardware in Chrome, the demo uses the Prompt API and Gemini Nano. There are only 3 requests made for the main document, the JavaScript file, and the CSS file.

![Firebase AI logic running in Chrome, using the built-in AI APIs.](/static/docs/ai/firebase-ai-logic/chrome.png)

When in another browser or an operating system without built-in AI support, there is an additional request made to the Firebase endpoint, `https://firebasevertexai.googleapis.com`.

![Firebase AI logic running in Safari, making a request to Firebase servers.](/static/docs/ai/firebase-ai-logic/safari.png)

Firebase AI Logic can be a great option to integrate AI capabilities to your web apps. By providing a fallback to the cloud when the Prompt API is unavailable, the SDK ensures wider accessibility and reliability of AI features.

Remember that cloud applications create new expectations for privacy and functionality, so it's important to inform your users of where their data is being processed.

-   For feedback on Chrome's implementation, file a [bug report](https://issues.chromium.org/issues/new?component=1617227&priority=P2&type=bug&template=0&noWizard=true) or a [feature request](https://issues.chromium.org/issues/new?component=1617227&priority=P2&type=feature_request&template=0&noWizard=true).
-   For feedback on Firebase AI Logic, file a [bug report](https://github.com/firebase/firebase-js-sdk/issues).

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-05-20 UTC.