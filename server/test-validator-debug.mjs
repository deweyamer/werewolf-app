import { ScriptValidator } from './src/game/script/ScriptValidator.js';

const validator = new ScriptValidator();

const script = {
  id: 'test-12',
  name: '测试剧本',
  description: '12人标准剧本',
  playerCount: 12,
  roleComposition: {
    wolf: 3,
    nightmare: 1,
    seer: 1,
    witch: 1,
    hunter: 1,
    guard: 1,
    villager: 4,
  },
  difficulty: 'medium',
  tags: [],
  rules: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const result = validator.validate(script);
console.log('Valid:', result.valid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
