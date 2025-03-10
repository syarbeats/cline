import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from "../index"
import { ApiHandlerOptions, ModelInfo, telkomAiDefaultModelId, TelkomAiModelId, telkomAiModels } from "../../shared/api"
import { withRetry } from "../retry"
import { ApiStream } from "../transform/stream"
import axios from "axios"

export class TelkomAiHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private baseUrl: string

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.baseUrl = options.telkomAiBaseUrl ?? "https://api-stage-aitools.telkom.design/v1/openai/chat/completions"
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			const response = await axios.post(
				`${this.baseUrl}`,
				{
					model: this.getModel().id,
					max_tokens: 5000,
					messages: [
						{ role: "system", content: systemPrompt },
						...messages.map((msg) => ({
							role: msg.role,
							content: msg.content,
						})),
					],
					stream: false,
				},
				{
					headers: {
						"Content-Type": "application/json",
						"Api-Key": this.options.apiKey,
					},
				},
			)

			// Yield the response text
			yield {
				type: "text",
				text: response.data.choices[0].message.content,
			}

			// Yield usage information if available
			if (response.data.usage) {
				yield {
					type: "usage",
					inputTokens: response.data.usage.prompt_tokens || 0,
					outputTokens: response.data.usage.completion_tokens || 0,
				}
			}
		} catch (error) {
			console.error("Telkom AI API Error:", error)
			throw error
		}
	}

	getModel(): { id: TelkomAiModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in telkomAiModels) {
			const id = modelId as TelkomAiModelId
			return { id, info: telkomAiModels[id] }
		}
		return {
			id: telkomAiDefaultModelId,
			info: telkomAiModels[telkomAiDefaultModelId],
		}
	}
}
