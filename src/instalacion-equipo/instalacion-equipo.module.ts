import { Module } from '@nestjs/common';
import { InstalacionEquipoService } from './instalacion-equipo.service';
import { InstalacionEquipoController } from './instalacion-equipo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipos } from 'src/entities/Equipos';
import { InstalacionEquipo } from 'src/entities/InstalacionEquipo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { InstalacionCentral } from 'src/entities/InstalacionCentral';
import { Arrendadores } from 'src/entities/Arrendadores';
import { CatDepartamentos } from 'src/entities/CatDepartamentos';

@Module({
  imports:[TypeOrmModule.forFeature([Equipos,InstalacionEquipo,InstalacionCentral, Arrendadores, CatDepartamentos]), BitacoraModule],
  controllers: [InstalacionEquipoController],
  providers: [InstalacionEquipoService],
})
export class InstalacionEquipoModule {}
