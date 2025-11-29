# HuggingFace Integration for Specter Mobile

## Core Architecture: Offline-First with Cloud Training

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SPECTER AI ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐         ┌─────────────────────────────────────┐   │
│   │   ON-DEVICE (Cactus)│         │   CLOUD (HuggingFace)               │   │
│   │   ================  │         │   =====================              │   │
│   │                     │         │                                      │   │
│   │   • GGUF Model      │◄────────│   • Fine-tuned Model (Safetensors)  │   │
│   │   • AgentMemory     │         │   • Training Data (Datasets)         │   │
│   │   • Real-time Prefs │────────►│   • DPO Training (TRL)              │   │
│   │   • Tool Calling    │         │   • GGUF Conversion                  │   │
│   │                     │         │                                      │   │
│   │   OFFLINE ✓         │         │   PERIODIC SYNC                      │   │
│   └─────────────────────┘         └─────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Value Proposition: Why This Matters

| Feature | Without HuggingFace | With HuggingFace |
|---------|---------------------|------------------|
| **Offline AI** | ✅ Generic Qwen model | ✅ Deal-sourcing optimized model |
| **Privacy** | ✅ All data on-device | ✅ All data on-device |
| **Personalization** | Via prompts only | Baked into model weights + prompts |
| **Response Quality** | Good | Significantly better |
| **Model Updates** | Manual | Automated pipeline |

---

## HuggingFace Services for Specter

### 1. **Datasets** - Store Training Data
Upload your DPO preference pairs to HuggingFace Hub.

```python
# From trainingLogger.ts export, upload to HuggingFace
from huggingface_hub import HfApi
api = HfApi()

# Upload your exported JSONL file
api.upload_file(
    path_or_fileobj="specter_dpo_export.jsonl",
    path_in_repo="train.jsonl",
    repo_id="iteratehack/specter-deal-preferences",  # Your org!
    repo_type="dataset"
)
```

**Dataset Format for DPO:**
```jsonl
{"prompt": "Evaluate: Senior AI Engineer at stealth startup, YC W24, ex-Google", "chosen": "LIKE - Strong signal: YC-backed, senior talent, stealth stage", "rejected": "PASS - No specific fit"}
{"prompt": "Evaluate: Marketing Manager at Series D fintech, 3 years exp", "chosen": "PASS - Not stealth stage, not technical founder", "rejected": "LIKE - Good experience"}
```

---

### 2. **AutoTrain** - No-Code Fine-Tuning
The easiest path to a custom model.

**Steps:**
1. Go to https://huggingface.co/spaces/autotrain-projects/autotrain-advanced
2. Create a private Space with GPU (A10G recommended)
3. Select "LLM Finetuning" task
4. Upload your DPO dataset
5. Choose base model: `Qwen/Qwen2.5-0.5B-Instruct` (similar to Cactus's qwen3-0.6)
6. Set training type: DPO
7. Train → Get Safetensors model

**Cost:** ~$5-20 per training run on HuggingFace Spaces

---

### 3. **TRL (Transformers RL)** - Programmatic Training
For more control, use TRL's DPOTrainer.

```python
from trl import DPOTrainer, DPOConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset

# Load your preference dataset
dataset = load_dataset("iteratehack/specter-deal-preferences")

# Load base model (small for mobile)
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")

# Configure DPO training
training_args = DPOConfig(
    output_dir="specter-deal-agent",
    per_device_train_batch_size=4,
    num_train_epochs=3,
    learning_rate=5e-7,
    beta=0.1,  # DPO temperature
    push_to_hub=True,
    hub_model_id="iteratehack/specter-deal-agent-v1"
)

# Train
trainer = DPOTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    tokenizer=tokenizer,
)
trainer.train()
trainer.push_to_hub()
```

---

### 4. **GGUF Conversion** - Make It Cactus-Compatible
Convert your fine-tuned model to GGUF format.

**Option A: Use HuggingFace Space**
https://huggingface.co/spaces/ggml-org/gguf-my-repo
- Input: `iteratehack/specter-deal-agent-v1`
- Output: Quantized GGUF file (Q4_K_M recommended for mobile)

**Option B: Local Conversion**
```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Convert to GGUF
python convert_hf_to_gguf.py iteratehack/specter-deal-agent-v1 \
    --outfile specter-deal-agent-q4.gguf \
    --outtype q4_k_m
```

**Quantization Options:**
| Type | Size | Quality | Recommended For |
|------|------|---------|-----------------|
| Q4_K_M | ~300MB | Good | Mobile (default) |
| Q5_K_M | ~400MB | Better | High-end mobile |
| Q8_0 | ~600MB | Best | Tablets/Desktop |

---

### 5. **Model Hosting** - Serve Your GGUF
Upload the GGUF to HuggingFace Hub for Cactus to download.

```python
api.upload_file(
    path_or_fileobj="specter-deal-agent-q4.gguf",
    path_in_repo="specter-deal-agent-q4.gguf",
    repo_id="iteratehack/specter-deal-agent-gguf",
    repo_type="model"
)
```

**Direct URL:**
```
https://huggingface.co/iteratehack/specter-deal-agent-gguf/resolve/main/specter-deal-agent-q4.gguf
```

---

## Cactus Integration Code

Update `cactusClient.native.ts` to support custom models:

```typescript
// src/ai/cactusClient.native.ts

export interface CactusClientConfig {
  model?: string;
  modelUrl?: string;  // Custom GGUF URL from HuggingFace
  contextSize?: number;
}

private constructor(config: CactusClientConfig = {}) {
  if (config.modelUrl) {
    // Use custom fine-tuned model from HuggingFace
    this.lm = new CactusLM({
      modelUrl: config.modelUrl,
      contextSize: config.contextSize ?? 2048,
    });
    this.model = 'custom';
    logger.info('CactusClient', `Using custom model: ${config.modelUrl}`);
  } else {
    // Use built-in Cactus model (default)
    this.model = config.model ?? 'qwen3-0.6';
    this.lm = new CactusLM({
      model: this.model,
      contextSize: config.contextSize ?? 2048,
    });
  }
}

// Factory method for custom models
static getCustomInstance(modelUrl: string): CactusClient {
  CactusClient.instance = new CactusClient({ modelUrl });
  return CactusClient.instance;
}
```

**Usage in App:**
```typescript
// In AgentContext or settings
const CUSTOM_MODEL_URL = 'https://huggingface.co/iterate/specter-deal-agent-gguf/resolve/main/specter-deal-agent-q4.gguf';

// Switch to fine-tuned model
const client = CactusClient.getCustomInstance(CUSTOM_MODEL_URL);
await client.download(onProgress);
await client.init();
```

---

## Complete Pipeline: App → HuggingFace → App

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CONTINUOUS IMPROVEMENT LOOP                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   1. COLLECT                    2. EXPORT                   3. UPLOAD         │
│   ┌─────────────┐              ┌─────────────┐             ┌─────────────┐   │
│   │ User Likes  │              │ trainingLog │             │ HuggingFace │   │
│   │ User Dislikes│──────────►  │ .exportFor  │────────────►│ Datasets    │   │
│   │ Voice Notes │              │ DPO()       │             │             │   │
│   └─────────────┘              └─────────────┘             └─────────────┘   │
│                                                                    │          │
│   6. DOWNLOAD                  5. CONVERT                  4. TRAIN│          │
│   ┌─────────────┐              ┌─────────────┐             ┌──────▼──────┐   │
│   │ Cactus SDK  │◄─────────────│ GGUF-my-repo│◄────────────│ AutoTrain   │   │
│   │ downloads   │              │ Space       │             │ or TRL      │   │
│   │ new model   │              │             │             │             │   │
│   └─────────────┘              └─────────────┘             └─────────────┘   │
│                                                                               │
│   7. INFERENCE (OFFLINE)                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │ Fine-tuned model + Real-time AgentMemory = Personalized AI Agent    │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## HuggingFace API Quick Reference

### Authentication
```typescript
// Get token from https://huggingface.co/settings/tokens
const HF_TOKEN = 'hf_...';

// Use in API calls
fetch('https://huggingface.co/api/datasets/iterate/specter-preferences', {
  headers: { 'Authorization': `Bearer ${HF_TOKEN}` }
});
```

### Upload Dataset (from React Native)
```typescript
// In trainingLogger.ts
async uploadToHuggingFace(dpoData: string): Promise<void> {
  const HF_TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN;
  
  const response = await fetch(
    'https://huggingface.co/api/datasets/iteratehack/specter-deal-preferences/upload/main/train.jsonl',
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: dpoData,
    }
  );
  
  if (!response.ok) throw new Error('Upload failed');
}
```

### Check Model Availability
```typescript
async function checkModelExists(repoId: string): Promise<boolean> {
  const response = await fetch(`https://huggingface.co/api/models/${repoId}`);
  return response.ok;
}
```

### Get Model Download URL
```typescript
function getGGUFUrl(repoId: string, filename: string): string {
  return `https://huggingface.co/${repoId}/resolve/main/${filename}`;
}

// Example
const modelUrl = getGGUFUrl('iteratehack/specter-deal-agent-gguf', 'specter-deal-agent-q4.gguf');
```

---

## Recommended Workflow for iteratehack Organization

**Organization:** https://huggingface.co/iteratehack
**Team Size:** 52 members
**Existing Model:** `iteratehack/qmul`

### Phase 1: Data Collection (Current)
- [x] `AgentMemory` records likes/dislikes
- [x] `trainingLogger.ts` exports DPO format
- [ ] Add "Export Training Data" button in Settings

### Phase 2: First Training Run
1. Export ~500+ preference pairs from app
2. Create dataset: `iteratehack/specter-deal-preferences`
3. Use AutoTrain Space to fine-tune Qwen2.5-0.5B
4. Convert to GGUF with gguf-my-repo
5. Upload model: `iteratehack/specter-deal-agent-gguf`

### Phase 3: Integration
1. Add model URL config to app settings
2. Implement model switching in CactusClient
3. A/B test: Generic vs Fine-tuned model

### Phase 4: Automation
1. Weekly batch export of new preferences
2. Automated retraining pipeline (GitHub Actions + HF Spaces)
3. Version management for models

---

## Cost Estimate

| Service | Cost | Frequency |
|---------|------|-----------|
| Dataset Storage | Free (< 10GB) | - |
| AutoTrain (A10G) | ~$3/hr | Per training (~2hrs) |
| Model Storage | Free (< 10GB) | - |
| Inference | Free (on-device) | - |

**Total: ~$6-12 per model update**

---

## Key Advantages of This Architecture

1. **Offline-First**: Cactus runs entirely on-device, no internet needed for inference
2. **Privacy**: User preferences never leave device (only aggregated for training)
3. **Personalization**: Two layers - model weights (trained) + prompts (real-time)
4. **Cost-Effective**: No inference API costs, only periodic training
5. **Iterative**: Model improves with each training cycle
6. **Portable**: GGUF format works across platforms (iOS, Android, Desktop)

---

## Next Steps

1. **Immediate**: Add "Export Training Data" to Settings screen
2. **This Week**: Create `iteratehack/specter-deal-preferences` dataset on HuggingFace
3. **Next Week**: First AutoTrain run with initial preferences
4. **Ongoing**: Monthly model updates based on accumulated preferences

---

## Quick Links for iteratehack

| Resource | URL |
|----------|-----|
| **Organization** | https://huggingface.co/iteratehack |
| **Create Dataset** | https://huggingface.co/new-dataset?organization=iteratehack |
| **Create Model** | https://huggingface.co/new?organization=iteratehack |
| **AutoTrain Space** | https://huggingface.co/spaces/autotrain-projects/autotrain-advanced |
| **GGUF Converter** | https://huggingface.co/spaces/ggml-org/gguf-my-repo |
| **TRL Docs (DPO)** | https://huggingface.co/docs/trl/dpo_trainer |

