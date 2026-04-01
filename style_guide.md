# 🚀 TypeScript Coding Style Guide (Enterprise + AI Enforced)

This document defines a strict, scalable, and AI-optimized TypeScript coding standard.
It is designed for **predictability, maintainability, and automated code generation**.

---

# 🧭 Core Principles

* Prefer **class-based architecture**
* Enforce **single responsibility per class**
* Use **interfaces over types**
* Enforce **strict typing (no `any`)**
* Keep functions **≤ 4 lines**
* Use **arrow functions only**
* Prefer **immutability**
* Use **exceptions (throw)** instead of error returns
* Enforce **structured logging in every function**
* Require **JSDoc for every class and function (WHY-focused)**

---

# 🧾 Naming Conventions

| Element    | Convention       | Example            |
| ---------- | ---------------- | ------------------ |
| Classes    | PascalCase       | `OrderService`     |
| Interfaces | PascalCase + I   | `IUser`            |
| Variables  | camelCase        | `orderAmount`      |
| Functions  | camelCase        | `createOrder`      |
| Constants  | UPPER_SNAKE_CASE | `MAX_RETRIES`      |
| Files      | kebab-case       | `order-service.ts` |

---

# 📁 File & Folder Structure

* One class per file
* File name must match class name
* Use kebab-case

```
controller/
services/
utilities/
interfaces/
```

---

# 📦 Import Rules

1. External libraries
2. Internal modules
3. Interfaces/types

* Prefer **absolute imports**
* No unused imports

---

# 📐 Formatting Rules

* Indentation: **4 spaces**
* Inline short `if` only

```ts
if (!order) throw new Error("Order not found");
```

* Blank line between logical blocks
* Avoid deep nesting

---

# 🧱 Architecture

```
Controller → Services → Utilities → Interfaces
```

* No cross-layer violations
* Services contain business logic only

---

# 🧩 Interfaces

* Always define interfaces for data contracts
* Avoid inline object types

---

# ⚙️ Functions

* Max **4 lines**
* Max **3 parameters**
* Always declare return type
* Use DTO if params > 3

```ts
create = (data: CreateUserDto): IUser => {}
```

---

# 🔁 Async Rules

* Use **async/await only**
* Never use `.then()`
* Never mix styles

---

# 🪵 Logging Standard

```ts
console.info("[functionName]: starting...");
console.info("[functionName]: finished!");
```

* Required in EVERY function

---

# ❗ Error Handling

* Always `throw Error`
* No error return objects
* Use decorator for wrapping

---

# 🧪 Decorator (Standard)

```ts
const HandleErrors = () => {
    return (target: object, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
        const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

        descriptor.value = async function (...args: unknown[]) {
            try {
                return await original.apply(this, args);
            } catch (error: unknown) {
                throw new Error(`[${propertyKey}] ${(error as Error).message}`);
            }
        };

        return descriptor;
    };
};
```

---

# 🧠 Immutability Rules

* Use `readonly` wherever possible
* Never mutate arrays/objects

```ts
this.orders = [...this.orders, newOrder];
```

---

# 🚫 Forbidden Patterns

* ❌ `any`
* ❌ functions > 4 lines
* ❌ nested functions
* ❌ class methods not arrow functions
* ❌ mutation (`push`, `splice`)
* ❌ `console.log`
* ❌ magic numbers
* ❌ inline complex objects

---

# 📏 Return Rules

* All functions MUST define return types
* No implicit returns

---

# 🧩 Union vs Enum

* Use **union types** for simple values
* Use **enums** for reusable/shared states

---

# 🧬 Dependency Injection

* Always inject via constructor
* Never instantiate dependencies inside class

```ts
constructor(private service: IService) {}
```

---

# 🧾 Commenting Rules

* JSDoc required for all classes/functions
* Must explain **WHY**, not WHAT
* Avoid inline comments

---

# 🧪 Testing Rules

* One test file per class
* Mock interfaces only
* No real dependencies in tests

---

# ⚡ Performance Rules

* Prefer early returns
* Avoid unnecessary spreads in loops

---

# 🧩 DTO Pattern

* Use DTOs for input
* Separate validation from logic (optional enforcement)

---

# ✅ Final Outcome

This guide ensures:

* Predictable AI-generated code
* Clean architecture
* Strong typing discipline
* High readability
* Scalable structure

---

If needed, next step:

* ESLint config (strict enforcement)
* Prettier config (4 spaces)
* AI prompt enforcement layer
