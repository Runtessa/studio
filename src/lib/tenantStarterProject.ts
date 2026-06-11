import { EntityManager } from 'typeorm';
import {
  HttpMethod,
  ModuleEntity,
  OrmModel,
  Tenant,
  UIPackage,
  SourceCode,
  CompiledCode,
} from '@idp/shared';
import { generateVersion } from '@/lib/version';
import { compileOrmSource } from '@/lib/orm-compiler';
import { compileUiSource } from '@/lib/assistant/compiler';

const STARTER_MODULE_ROUTE = '/api/hello';
const STARTER_MODULE_METHOD = HttpMethod.GET;
const STARTER_MODEL_PATH = 'models/ExampleItem.js';
const STARTER_ROUTES_NAME = '@app/routes';
const STARTER_ROUTES_VERSION = '1.0.0';
const STARTER_UI_NAME = '@app/dashboard';
const STARTER_UI_VERSION = '1.0.0';

const STARTER_MODULE_CODE = `/** @type {IdpModuleHandler} */
module.exports = async function handler(req, adapters) {
  return {
    statusCode: 200,
    body: {
      ok: true,
      message: 'Your tenant starter project is ready.',
      nextSteps: [
        'Edit this module in the IDE.',
        'Update the ExampleItem model.',
        'Replace StarterPanel with your own UI.',
      ],
    },
  };
};
`;

const STARTER_MODEL_CODE = `// Starter ORM model for your tenant.
// You can rename this file or extend the entity fields in the IDE.

const { Entity, PrimaryGeneratedColumn, Column } = require('typeorm');

@Entity({ name: 'example_items' })
class ExampleItem {
  @PrimaryGeneratedColumn('uuid')
  id;

  @Column()
  name;

  @Column({ default: true })
  isActive;
}

module.exports = { ExampleItem };
`;

const STARTER_UI_CODE = `import React from "react";

export default function App() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#0b1220]">
      {/* Circuit-style background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_55%)]" />

        <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,rgba(59,130,246,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.18)_1px,transparent_1px)] bg-[size:42px_42px]" />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-[15%] w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          <div className="absolute top-[60%] left-[70%] w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          <div className="absolute top-[40%] left-[50%] w-2 h-2 bg-blue-300 rounded-full shadow-[0_0_8px_rgba(147,197,253,0.7)]" />
        </div>
      </div>

      {/* Glass card */}
      <div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative"
      >
        <div className="w-[420px] rounded-2xl border border-white/10 bg-transparent backdrop-blur-[1px] shadow-[0_8px_30px_rgba(0,0,0,0.2)] overflow-hidden">
          {/* subtle top highlight */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-blue-300/40 to-transparent" />

          <div className="px-10 py-14 text-center">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              Hello, World
            </h1>

            <p className="mt-4 text-blue-100/70 text-sm">
              Fully transparent glass (minimal HUD style)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

const STARTER_ROUTES_CODE = `const routes = [
  {
    path: "/",
    redirectTo: "/dashboard",
  },
  {
    path: "/dashboard",
    package: "@app/dashboard",
    requireAuth: true,
  },
];

export default routes;
`;

const ensureAclEndpoint = (tenant: Tenant, routePath: string) => {
  const endpoints = ((tenant.aclEndpoints ?? {}) as Record<
    string,
    { read?: string[]; write?: string[]; edit?: string[]; delete?: string[]; allowAnonymous?: boolean }
  >);
  if (endpoints[routePath]) {
    return false;
  }
  endpoints[routePath] = {
    read: [],
    write: [],
    edit: [],
    delete: [],
    allowAnonymous: true,
  };
  tenant.aclEndpoints = endpoints as Tenant['aclEndpoints'];
  return true;
};

export const seedTenantStarterProject = async (
  manager: EntityManager,
  tenant: Tenant,
) => {
  const moduleRepo = manager.getRepository(ModuleEntity);
  const modelRepo = manager.getRepository(OrmModel);
  const uiRepo = manager.getRepository(UIPackage);
  const sourceRepo = manager.getRepository(SourceCode);
  const compiledRepo = manager.getRepository(CompiledCode);

  const [existingModule, existingModel, existingRoutes, existingUi] = await Promise.all([
    moduleRepo.findOne({
      where: {
        tenant: { id: tenant.id },
        routePath: STARTER_MODULE_ROUTE,
        method: STARTER_MODULE_METHOD,
      },
    }),
    modelRepo.findOne({
      where: {
        tenant: { id: tenant.id },
        path: STARTER_MODEL_PATH,
      },
    }),
    uiRepo.findOne({
      where: {
        tenant: { id: tenant.id },
        name: STARTER_ROUTES_NAME,
        version: STARTER_ROUTES_VERSION,
      },
    }),
    uiRepo.findOne({
      where: {
        tenant: { id: tenant.id },
        name: STARTER_UI_NAME,
        version: STARTER_UI_VERSION,
      },
    }),
  ]);

  if (!existingModule) {
    const sourceCode = sourceRepo.create({ code: STARTER_MODULE_CODE });
    await sourceRepo.save(sourceCode);
    const mod = moduleRepo.create({
      tenant,
      routePath: STARTER_MODULE_ROUTE,
      method: STARTER_MODULE_METHOD,
      sourceCode,
      fileExtension: 'js',
      draftVersion: generateVersion(),
    });
    await moduleRepo.save(mod);
  }

  if (!existingModel) {
    const sourceCode = sourceRepo.create({ code: STARTER_MODEL_CODE });
    const codeBlob = compileOrmSource(STARTER_MODEL_CODE, 'js');
    const compiledCode = compiledRepo.create({ code: codeBlob });
    await sourceRepo.save(sourceCode);
    await compiledRepo.save(compiledCode);
    const model = modelRepo.create({
      tenant,
      path: STARTER_MODEL_PATH,
      sourceCode,
      compiledCode,
      fileExtension: 'js',
      draftVersion: generateVersion(),
    });
    await modelRepo.save(model);
  }

  if (!existingUi) {
    const sourceCode = sourceRepo.create({ code: STARTER_UI_CODE });
    const codeBlob = compileUiSource(STARTER_UI_CODE, 'jsx');
    const compiledCode = compiledRepo.create({ code: codeBlob });
    await sourceRepo.save(sourceCode);
    await compiledRepo.save(compiledCode);
    const pkg = uiRepo.create({
      tenant,
      name: STARTER_UI_NAME,
      version: STARTER_UI_VERSION,
      sourceCode,
      compiledCode,
      dependencies: [],
      fileExtension: 'jsx',
      draftVersion: generateVersion(),
    });
    await uiRepo.save(pkg);
  }

  if (!existingRoutes) {
    const sourceCode = sourceRepo.create({ code: STARTER_ROUTES_CODE });
    const codeBlob = compileUiSource(STARTER_ROUTES_CODE, 'ts');
    const compiledCode = compiledRepo.create({ code: codeBlob });
    await sourceRepo.save(sourceCode);
    await compiledRepo.save(compiledCode);
    const pkg = uiRepo.create({
      tenant,
      name: STARTER_ROUTES_NAME,
      version: STARTER_ROUTES_VERSION,
      sourceCode,
      compiledCode,
      dependencies: [],
      fileExtension: 'ts',
      draftVersion: generateVersion(),
    });
    await uiRepo.save(pkg);
  }

  if (ensureAclEndpoint(tenant, STARTER_MODULE_ROUTE)) {
    await manager.getRepository(Tenant).save(tenant);
  }
};
