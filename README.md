# Boberto

Lightweight VS Code extension to create custom Problems using `@boberto` tags inside your codebase.

---

## How It Works

Add `@boberto` inside comments to create entries in the **Problems panel**.

The extension scans your entire workspace and converts tagged comments into Problems with custom severity.

---

## Basic Usage

```js
// @boberto: Refactor this function

// @boberto @critico: Fix security issue

/*
  @boberto @aviso: Improve performance here
*/