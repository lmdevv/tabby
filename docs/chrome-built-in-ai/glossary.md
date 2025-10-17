# What is artificial intelligence?

## What is artificial intelligence?

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

Artificial intelligence (AI) encompasses many complex, emerging technologies that once required human input and can now be performed by a computer. Broadly speaking, AI is a non-human program or model that demonstrates a broad range of problem-solving and creativity.

The acronym AI is often used interchangeably to represent various types of technologies within the field of artificial intelligence, but these can vary greatly in scope.

There are a number of [terms and concepts](https://developers.google.com/machine-learning/glossary/) which define artificial intelligence and machine learning, that you may find useful. Here you'll find terms common in Chrome's documentation, most critically, around client-side AI.

## Client-side AI

While most AI features on the web rely on servers, _client-side AI_ runs in the user's browser and performs inference on the user's device. This has [numerous benefits](/docs/ai/client-side), including lower latency, reduced cost to create features, increased user privacy, and offline access.

Client-side AI relies on smaller, optimized models, that are [optimized for performance](https://web.dev/articles/client-side-ai-performance). It's possible such models to outperform larger server-side models for specific tasks. Assess your use case to determine what solution is right for you.

### Built-in AI

![](/static/docs/ai/glossary/images/built-in-infra.jpg)

With built-in AI, your website connects with browser APIs to the local processor. The browser built-in model sends a response, which the API returns to your website.

[_Built-in AI_](/docs/ai/built-in) is a form of client-side AI, where the smaller models are built into the browser. For Chrome, this includes Gemini Nano and expert models. Once these models are downloaded, all websites and web applications that use built-in AI can skip the download time and get right to feature execution and local inference.

The [built-in AI APIs](/docs/ai/built-in-apis) are designed to run inference against the right type of model for the task. For example, the [Prompt API](/docs/ai/prompt-api) runs inference against a language model, while the [Translator API](/docs/ai/translator-api) runs inference against a built-in expert model.

## Server-side AI

_Server-side AI_ encompasses cloud-based AI services. Think Gemini 1.5 Pro running on a cloud. These models tend to be much larger and more powerful. This is especially true of [large language models](https://web.dev/articles/llm-sizes).

## Hybrid AI

_Hybrid AI_ refers to any solution including both a client and server component. For example:

-   Client-side models that have a fallback to server-side models, built for tasks that cannot be completed effectively on the device.
    -   There may be a lack of resources on the device.
    -   The model or API is only available in certain environments.
-   A model split between client and server for security.
    -   For example, you could split a model such that 75% of the execution happens in the client, while the remaining 25% is performed on a server. This brings [client-side benefits](/docs/ai/client-side), while allowing part of the model to be off-device, thus remaining private.

If you use the [Prompt API](/docs/ai/prompt-api), you can set up hybrid architecture with [Firebase AI Logic](/docs/ai/firebase-ai-logic).

## Generative AI

_Generative AI_ is a form of machine learning that helps users create content that feels familiar and mimics human creation. Generative AI uses language models to organize data and create or modify text, images, video, and audio, based on supplied context. Generative AI goes beyond pattern matching and predictions.

A _large language model (LLM)_ has numerous (up to billions) parameters that you can use to perform a wide variety of tasks, such as generating, classifying, or summarizing text or images.

A _small language model (SLM)_ has significantly fewer parameters to perform similar tasks, and may be usable client-side.

### Natural language processing (NLP)

Natural language processing is a class of ML that focuses on helping computers comprehend human language, from the rules of any particular language to the idiosyncrasies, dialect, and slang used by individuals.

## Agent or AI agent

An [agent](https://developers.google.com/machine-learning/glossary#agent) is software that autonomously plans and executes a series of actions to complete a task on a user's behalf, while adapting to changes in its environment. Actions may include API functions or database queries, performed on a webpage or through a third-party application, such as [Project Mariner](https://deepmind.google/models/project-mariner/).

A chatbot is not inherently an agent. While a chatbot responds to a messenger (be it human or otherwise) and relies on a model to generate content, such as answers to questions, an agent interacts with tools or a database to complete a task.

## Additional resources

If you're new to AI on the web, check out our [collection of web.dev AI resources](https://web.dev/explore/ai).

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-07-21 UTC.