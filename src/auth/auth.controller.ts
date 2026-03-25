import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('login')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('usuario/recuperar/acceso')
  async email(@Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto) {
    console.log('Envia el correo.')
    return await this.authService.recuperarContrasena(loginAuthConfirmacionDto);
  }


  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicio de sesión (access + refresh JWT)' })
  async login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.signIn(loginAuthDto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar access y refresh (rotación de sesión)' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revocar la sesión de refresh indicada' })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logoutRefresh(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil del usuario autenticado (datos y permisos)' })
  async me(@Req() req) {
    return this.authService.getProfile(req.user.userId);
  }

  @Patch('cambiar/accesso')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cambiar contraseña (revoca todas las sesiones refresh del usuario)' })
  async resetPassword(@Body() loginAuthResetDto: LoginAuthResetDto) {
    return await this.authService.resetPassword(loginAuthResetDto);
  }
}
