import { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";
import { groq, GROQ_MODEL } from "./groq";

export const generateChatCompletion = async (
  options: Omit<ChatCompletionCreateParamsNonStreaming, "model">
) => {
  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0,
    ...options,
  });
  return response.choices[0].message;
};
