const readReferences = (value = []) => {
  if (!Array.isArray(value)) throw new Error('Invalid image references');
  return value.map((reference) => {
    if (!/^image\/(png|jpeg|webp)$/.test(reference?.mimeType) ||
        typeof reference?.data !== 'string' || !reference.data.length) {
      throw new Error('Invalid image reference data');
    }
    return { mimeType: reference.mimeType, data: reference.data };
  });
};

export const buildGeminiImageRequest = (body) => ({
  model: body.model,
  contents: {
    parts: [
      { text: body.prompt || '' },
      ...readReferences(body.referenceImages).map((reference) => ({ inlineData: reference })),
    ],
  },
  config: { imageConfig: { aspectRatio: body.aspectRatio } },
});

/** Shared by the local server and the Supabase function. */
export const generateOpenAIImage = async (client, body, defaultModel, toFile) => {
  const { apiKey, baseUrl, chatModel, referenceImages, extra_body, ...request } = body;
  const references = readReferences(referenceImages);
  const model = body.model || defaultModel;

  if (/seedream/i.test(model)) {
    return client.images.generate({
      ...request,
      ...extra_body,
      model,
      ...(references.length ? {
        image: references.map(({ mimeType, data }) => `data:${mimeType};base64,${data}`),
      } : {}),
    });
  }

  if (!references.length) return client.images.generate({ ...request, model });

  const image = await Promise.all(references.map(({ mimeType, data }, index) =>
    toFile(Uint8Array.from(atob(data), (character) => character.charCodeAt(0)),
      `style-reference-${index}.${mimeType.split('/')[1]}`, { type: mimeType })));
  // GPT image models return base64 images and do not accept response_format.
  const { response_format, ...editRequest } = request;
  if (/^gpt-image-1(?:[.-]|$)/i.test(model)) {
    const [width, height] = String(request.size).split('x').map(Number);
    editRequest.size = width === height ? '1024x1024' : width > height ? '1536x1024' : '1024x1536';
  }
  return client.images.edit({ ...editRequest, model, image });
};
