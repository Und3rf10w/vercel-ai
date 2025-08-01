import { z } from 'zod/v4';
import { JSONObject } from '@ai-sdk/provider';
import { FlexibleSchema, Tool } from '@ai-sdk/provider-utils';

export const LATEST_PROTOCOL_VERSION = '2025-06-18';
export const SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  '2025-03-26',
  '2024-11-05',
];

export type ToolSchemas =
  | Record<string, { inputSchema: FlexibleSchema<JSONObject | unknown> }>
  | 'automatic'
  | undefined;

type MappedTool<T extends Tool | JSONObject, OUTPUT extends any> =
  T extends Tool<infer INPUT>
    ? Tool<INPUT, OUTPUT>
    : T extends JSONObject
      ? Tool<T, OUTPUT>
      : never;

export type McpToolSet<TOOL_SCHEMAS extends ToolSchemas = 'automatic'> =
  TOOL_SCHEMAS extends Record<string, { inputSchema: FlexibleSchema<unknown> }>
    ? {
        [K in keyof TOOL_SCHEMAS]: MappedTool<TOOL_SCHEMAS[K], CallToolResult> &
          Required<
            Pick<MappedTool<TOOL_SCHEMAS[K], CallToolResult>, 'execute'>
          >;
      }
    : McpToolSet<Record<string, { inputSchema: FlexibleSchema<unknown> }>>;

const ClientOrServerImplementationSchema = z
  .object({
    name: z.string(),
    version: z.string(),
  })
  .passthrough();
export type Configuration = z.infer<typeof ClientOrServerImplementationSchema>;

export const BaseParamsSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
  })
  .passthrough();
type BaseParams = z.infer<typeof BaseParamsSchema>;
export const ResultSchema = BaseParamsSchema;

export const RequestSchema = z.object({
  method: z.string(),
  params: z.optional(BaseParamsSchema),
});
export type Request = z.infer<typeof RequestSchema>;
export type RequestOptions = {
  signal?: AbortSignal;
  timeout?: number;
  maxTotalTimeout?: number;
};

export type Notification = z.infer<typeof RequestSchema>;

const ServerCapabilitiesSchema = z
  .object({
    experimental: z.optional(z.object({}).passthrough()),
    logging: z.optional(z.object({}).passthrough()),
    prompts: z.optional(
      z
        .object({
          listChanged: z.optional(z.boolean()),
        })
        .passthrough(),
    ),
    resources: z.optional(
      z
        .object({
          subscribe: z.optional(z.boolean()),
          listChanged: z.optional(z.boolean()),
        })
        .passthrough(),
    ),
    tools: z.optional(
      z
        .object({
          listChanged: z.optional(z.boolean()),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type ServerCapabilities = z.infer<typeof ServerCapabilitiesSchema>;

export const InitializeResultSchema = ResultSchema.extend({
  protocolVersion: z.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ClientOrServerImplementationSchema,
  instructions: z.optional(z.string()),
});
export type InitializeResult = z.infer<typeof InitializeResultSchema>;

export type PaginatedRequest = Request & {
  params?: BaseParams & {
    cursor?: string;
  };
};

const PaginatedResultSchema = ResultSchema.extend({
  nextCursor: z.optional(z.string()),
});

const ToolSchema = z
  .object({
    name: z.string(),
    description: z.optional(z.string()),
    inputSchema: z
      .object({
        type: z.literal('object'),
        properties: z.optional(z.object({}).passthrough()),
      })
      .passthrough(),
  })
  .passthrough();
export type MCPTool = z.infer<typeof ToolSchema>;
export const ListToolsResultSchema = PaginatedResultSchema.extend({
  tools: z.array(ToolSchema),
});
export type ListToolsResult = z.infer<typeof ListToolsResultSchema>;

const TextContentSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
  })
  .passthrough();
const ImageContentSchema = z
  .object({
    type: z.literal('image'),
    data: z.string().base64(),
    mimeType: z.string(),
  })
  .passthrough();
const ResourceContentsSchema = z
  .object({
    /**
     * The URI of this resource.
     */
    uri: z.string(),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: z.optional(z.string()),
  })
  .passthrough();
const TextResourceContentsSchema = ResourceContentsSchema.extend({
  text: z.string(),
});
const BlobResourceContentsSchema = ResourceContentsSchema.extend({
  blob: z.string().base64(),
});
const EmbeddedResourceSchema = z
  .object({
    type: z.literal('resource'),
    resource: z.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
  })
  .passthrough();

export const CallToolResultSchema = ResultSchema.extend({
  content: z.array(
    z.union([TextContentSchema, ImageContentSchema, EmbeddedResourceSchema]),
  ),
  isError: z.boolean().default(false).optional(),
}).or(
  ResultSchema.extend({
    toolResult: z.unknown(),
  }),
);
export type CallToolResult = z.infer<typeof CallToolResultSchema>;
