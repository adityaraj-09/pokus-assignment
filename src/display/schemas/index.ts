import { ResultDisplaySchema, SchemaRegistry } from '../types.js';
import { hotelSchema } from './hotel.js';
import { attractionSchema } from './attraction.js';
import { pharmacySchema } from './pharmacy.js';

class SchemaRegistryImpl implements SchemaRegistry {
  private schemas: Map<string, ResultDisplaySchema<unknown>> = new Map();

  register<T>(schema: ResultDisplaySchema<T>): void {
    this.schemas.set(schema.type, schema as ResultDisplaySchema<unknown>);
  }

  get<T>(type: string): ResultDisplaySchema<T> | undefined {
    return this.schemas.get(type) as ResultDisplaySchema<T> | undefined;
  }

  has(type: string): boolean {
    return this.schemas.has(type);
  }

  list(): string[] {
    return Array.from(this.schemas.keys());
  }
}

export const schemaRegistry = new SchemaRegistryImpl();

schemaRegistry.register(hotelSchema);
schemaRegistry.register(attractionSchema);
schemaRegistry.register(pharmacySchema);

export { hotelSchema, attractionSchema, pharmacySchema };
