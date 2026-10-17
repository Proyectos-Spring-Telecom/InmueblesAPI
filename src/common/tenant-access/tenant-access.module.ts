import { Global, Module } from '@nestjs/common';
import { PerteneceAlClienteGuard } from './pertenece-al-cliente.decorator';
import { TenantAccessService } from './tenant-access.service';

/** Validación de pertenencia de recursos al cliente del JWT, disponible en toda la app. */
@Global()
@Module({
  providers: [TenantAccessService, PerteneceAlClienteGuard],
  exports: [TenantAccessService, PerteneceAlClienteGuard],
})
export class TenantAccessModule {}
