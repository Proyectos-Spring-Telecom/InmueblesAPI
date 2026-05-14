import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { BitacoraModule } from 'src/bitacora/bitacora.module';

@Module({
  imports: [HttpModule, BitacoraModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
