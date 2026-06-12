


```json
{
  "task_id": "6a2a87fcd3073ae94bb94c01",
  "custom_id": null,
  "video_source": {
    "type": "asset_id",
    "asset_id": "6a2a8680292dd4558c0f8efd",
    "system_metadata": {
      "duration": 1342.2
    }
  },
  "request_params": {
    "analysis_mode": "general",
    "prompt_v2": {
      "input_text": "Break down the video by main event and timestamp and create chapters based on the different scenes/pages i am demoing in the application."
    },
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "type": "object",
        "properties": {
          "episode_metadata": {
            "type": "object",
            "properties": {
              "show_title": {
                "type": "string"
              },
              "duration_seconds": {
                "type": "integer"
              }
            },
            "required": [
              "show_title"
            ]
          },
          "scenes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "scene_id": {
                  "type": "string"
                },
                "start": {
                  "type": "number"
                },
                "end": {
                  "type": "number"
                },
                "setting": {
                  "type": "string"
                },
                "characters_present": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "emotional_tone": {
                  "type": "string",
                  "enum": [
                    "neutral",
                    "happy",
                    "sad",
                    "tense",
                    "funny",
                    "dramatic"
                  ]
                },
                "summary": {
                  "type": "string"
                }
              },
              "required": [
                "scene_id",
                "start",
                "end",
                "summary"
              ]
            }
          }
        },
        "required": [
          "episode_metadata",
          "scenes"
        ]
      }
    },
    "temperature": 0.2,
    "max_tokens": 4096
  },
  "status": "ready",
  "created_at": "2026-06-11T10:03:40Z",
  "completed_at": "2026-06-11T10:05:40Z",
  "result": {
    "generation_id": "0ef8755f-a58c-4ca5-99ca-019a48ccaf0b",
    "data": "{\n  \"episode_metadata\": {\n    \"show_title\": \"Supabase AI Coding Engine Demo\",\n    \"duration_seconds\": 1342\n  },\n  \"scenes\": [\n    {\n      \"scene_id\": \"scene_1\",\n      \"start\": 0.0,\n      \"end\": 20.0,\n      \"setting\": \"Introduction\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Introduction to Supabase and the AI coding engine.\"\n    },\n    {\n      \"scene_id\": \"scene_2\",\n      \"start\": 20.0,\n      \"end\": 84.0,\n      \"setting\": \"Dashboard Overview\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Overview of the Supabase dashboard and its features.\"\n    },\n    {\n      \"scene_id\": \"scene_3\",\n      \"start\": 84.0,\n      \"end\": 134.0,\n      \"setting\": \"AI Coding Engine Demo\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Demonstration of the AI coding engine's capabilities.\"\n    },\n    {\n      \"scene_id\": \"scene_4\",\n      \"start\": 134.0,\n      \"end\": 190.0,\n      \"setting\": \"SQL Editor Exploration\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Exploring the SQL editor and AI-generated code.\"\n    },\n    {\n      \"scene_id\": \"scene_5\",\n      \"start\": 190.0,\n      \"end\": 295.0,\n      \"setting\": \"SQL Query Generation\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Using the AI coding engine to generate SQL queries.\"\n    },\n    {\n      \"scene_id\": \"scene_6\",\n      \"start\": 295.0,\n      \"end\": 405.0,\n      \"setting\": \"Query Review\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Reviewing the generated SQL queries and their results.\"\n    },\n    {\n      \"scene_id\": \"scene_7\",\n      \"start\": 405.0,\n      \"end\": 477.0,\n      \"setting\": \"Chat Interface Exploration\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Exploring the AI coding engine's chat interface.\"\n    },\n    {\n      \"scene_id\": \"scene_8\",\n      \"start\": 477.0,\n      \"end\": 552.0,\n      \"setting\": \"Code Generation Demo\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Demonstrating the AI coding engine's ability to generate code for different tasks.\"\n    },\n    {\n      \"scene_id\": \"scene_9\",\n      \"start\": 552.0,\n      \"end\": 605.0,\n      \"setting\": \"Code Performance Review\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Reviewing the AI-generated code and its performance.\"\n    },\n    {\n      \"scene_id\": \"scene_10\",\n      \"start\": 605.0,\n      \"end\": 690.0,\n      \"setting\": \"Tool Integration Exploration\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Exploring the AI coding engine's integration with other tools.\"\n    },\n    {\n      \"scene_id\": \"scene_11\",\n      \"start\": 690.0,\n      \"end\": 743.0,\n      \"setting\": \"Programming Languages Demo\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Demonstrating the AI coding engine's ability to generate code for different programming languages.\"\n    },\n    {\n      \"scene_id\": \"scene_12\",\n      \"start\": 743.0,\n      \"end\": 804.0,\n      \"setting\": \"Code Performance Review\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Reviewing the AI-generated code and its performance.\"\n    },\n    {\n      \"scene_id\": \"scene_13\",\n      \"start\": 804.0,\n      \"end\": 857.0,\n      \"setting\": \"Frameworks Exploration\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Exploring the AI coding engine's ability to generate code for different frameworks.\"\n    },\n    {\n      \"scene_id\": \"scene_14\",\n      \"start\": 857.0,\n      \"end\": 920.0,\n      \"setting\": \"Code Performance Review\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Reviewing the AI-generated code and its performance.\"\n    },\n    {\n      \"scene_id\": \"scene_15\",\n      \"start\": 920.0,\n      \"end\": 962.0,\n      \"setting\": \"Databases Exploration\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Exploring the AI coding engine's ability to generate code for different databases.\"\n    },\n    {\n      \"scene_id\": \"scene_16\",\n      \"start\": 962.0,\n      \"end\": 1034.0,\n      \"setting\": \"Code Performance Review\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Reviewing the AI-generated code and its performance.\"\n    },\n    {\n      \"scene_id\": \"scene_17\",\n      \"start\": 1034.0,\n      \"end\": 1082.0,\n      \"setting\": \"APIs Exploration\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Exploring the AI coding engine's ability to generate code for different APIs.\"\n    },\n    {\n      \"scene_id\": \"scene_18\",\n      \"start\": 1082.0,\n      \"end\": 1178.0,\n      \"setting\": \"Code Performance Review\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Reviewing the AI-generated code and its performance.\"\n    },\n    {\n      \"scene_id\": \"scene_19\",\n      \"start\": 1178.0,\n      \"end\": 1219.0,\n      \"setting\": \"Cloud Platforms Exploration\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Exploring the AI coding engine's ability to generate code for different cloud platforms.\"\n    },\n    {\n      \"scene_id\": \"scene_20\",\n      \"start\": 1219.0,\n      \"end\": 1277.0,\n      \"setting\": \"Code Performance Review\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Reviewing the AI-generated code and its performance.\"\n    },\n    {\n      \"scene_id\": \"scene_21\",\n      \"start\": 1277.0,\n      \"end\": 1342.0,\n      \"setting\": \"Conclusion\",\n      \"characters_present\": [\n        \"Presenter\"\n      ],\n      \"emotional_tone\": \"neutral\",\n      \"summary\": \"Conclusion and summary of the AI coding engine's capabilities.\"\n    }\n  ]\n}",
    "finish_reason": "stop",
    "usage": {
      "output_tokens": 2049
    }
  }
}
```

