import nunjucks from 'nunjucks';

export type PromptTemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | object
  | PromptTemplateValue[];

export interface PromptTemplateValues {
  [key: string]: PromptTemplateValue;
}

const promptTemplateEnvironment = new nunjucks.Environment(undefined, {
  autoescape: false,
  throwOnUndefined: false
});

export const renderPromptTemplate = (template: string, values: PromptTemplateValues) =>
  promptTemplateEnvironment.renderString(template, values);

export const joinPromptSections = (...sections: Array<string | null | undefined | false>) =>
  sections
    .filter((section): section is string => typeof section === 'string' && section.trim().length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
