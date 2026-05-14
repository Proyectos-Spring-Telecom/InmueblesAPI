import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

/** Usuario inyectado por JwtStrategy tras validar el JWT de acceso. */
type JwtAccessUser = {
  userId: number;
  email?: string;
  cliente: number | null;
  rol: number;
};

@ApiTags('Chat IA')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Enviar mensaje al agente IA',
    description:
      'Envía una pregunta en lenguaje natural al agente SpringAgent. ' +
      'Requiere autenticación JWT. El agente puede consultar clientes, usuarios ' +
      'y otros datos del negocio usando herramientas internas.',
  })
  @ApiResponse({ status: 200, description: 'Respuesta del agente IA' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 503, description: 'Servicio SpringAgent no disponible' })
  async chat(
    @Body() chatRequestDto: ChatRequestDto,
    @Req() req: Request & { user: JwtAccessUser },
  ) {
    const user = req.user;
    const userId = user.userId;
    const clienteId = user.cliente ?? null;
    const rol = user.rol;

    return this.chatService.sendMessage(
      chatRequestDto.message,
      chatRequestDto.conversationId,
      userId,
      clienteId,
      rol,
    );
  }
}
