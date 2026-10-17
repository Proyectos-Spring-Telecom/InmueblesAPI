import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UpdateUsuarioContrasena } from './dto/update-usuario-contrasena.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioEstatusDto } from './dto/update-usuario-estatus.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

    @Post()
    @UseInterceptors(
      FileInterceptor('fotoPerfil', {
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10 MB
        fileFilter: (req, file, cb) => {
          const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
          if (!allowedTypes.includes(file.mimetype)) {
            return cb(
              new Error('Solo se permiten PNG, JPG o JPEG para foto de perfil'),
              false,
            );
          }
          cb(null, true);
        },
      }),
    )
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ 
      summary: 'Crear nuevo usuario',
      description: 'Crea un nuevo usuario en el sistema. Requiere autenticación JWT. El usuario recibirá un correo de confirmación. Puede incluir una foto de perfil.'
    })
    @ApiBody({ type: CreateUsuarioDto })
    @ApiResponse({ 
      status: 201, 
      description: 'Usuario creado exitosamente',
      schema: {
        example: {
          status: 'success',
          message: 'Usuario creado correctamente',
          data: {
            id: 1,
            nombre: 'Juan Pérez'
          }
        }
      }
    })
    @ApiResponse({ status: 400, description: 'Datos inválidos o usuario ya existe' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async createUsuario(
      @Body() createUsuarioDto: CreateUsuarioDto,
      @UploadedFile() fotoPerfil: Express.Multer.File,
      @Req() req
    ): Promise<ApiCrudResponse> {
      const idUser = req.user.userId;
      return await this.usuariosService.createUsuario(createUsuarioDto, idUser, fotoPerfil);
    }
  
    // ========================================
    // 🔹 GET ROUTES - Rutas específicas primero
    // ========================================
    
    @Get('list')
    @ApiOperation({ 
      summary: 'Obtener todos los usuarios sin paginación',
      description: 'Obtiene una lista completa de todos los usuarios activos. Los SuperAdministradores ven todos los usuarios, otros roles solo ven usuarios de su cliente.'
    })
    @ApiResponse({ 
      status: 200, 
      description: 'Lista completa de usuarios',
      schema: {
        example: {
          data: [
            {
              Id: 1,
              UserName: 'usuario01',
              Nombre: 'Juan',
              ApellidoPaterno: 'Pérez',
              ApellidoMaterno: 'López',
              Telefono: '5512345678',
              Estatus: 1,
              IdRol: 2,
              RolNombre: 'Administrador',
              IdCliente: 5,
              clienteNombre: 'Empresa ABC'
            }
          ]
        }
      }
    })
    @ApiResponse({ status: 404, description: 'No se encontraron usuarios' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async findAllList(@Req() req): Promise<ApiResponseCommon> {
      const cliente = req.user.cliente;
      const rol = req.user.rol;
      return await this.usuariosService.getAllListUsuarios(+cliente, +rol);
    }

    @Get('list/cliente')
    @ApiOperation({ 
      summary: 'Obtener usuarios por cliente específico',
      description: 'Obtiene todos los usuarios activos del cliente asociado al usuario autenticado.'
    })
    @ApiResponse({ 
      status: 200, 
      description: 'Lista de usuarios del cliente',
      schema: {
        example: {
          data: [
            {
              id: 1,
              userName: 'usuario01',
              nombre: 'Juan',
              apellidoPaterno: 'Pérez',
              estatus: 1
            }
          ]
        }
      }
    })
    @ApiResponse({ status: 404, description: 'Usuarios no encontrados' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async findAllListUsuarioCliente(
      @Req() req
    ): Promise<ApiResponseCommon> {
      // El JWT expone `cliente` (no `idCliente`); con `idCliente` el filtro quedaba vacío y devolvía usuarios de todos los clientes.
      return await this.usuariosService.getAllListUsuariosCliente(
        Number(req.user?.cliente || 0),
        Number(req.user?.rol || 0),
      );
    }
  
    @Get(':page/:limit')
    @ApiOperation({ 
      summary: 'Obtener usuarios con paginación',
      description: 'Obtiene una lista paginada de usuarios. Los SuperAdministradores ven todos los usuarios, otros roles solo ven usuarios de su cliente.'
    })
    @ApiParam({ name: 'page', description: 'Número de página', example: 1, type: Number })
    @ApiParam({ name: 'limit', description: 'Cantidad de elementos por página', example: 10, type: Number })
    @ApiResponse({ 
      status: 200, 
      description: 'Lista de usuarios paginada',
      schema: {
        example: {
          data: [
            {
              Id: 1,
              UserName: 'usuario01',
              Nombre: 'Juan',
              ApellidoPaterno: 'Pérez',
              Estatus: 1,
              IdRol: 2,
              RolNombre: 'Administrador'
            }
          ],
          paginated: {
            total: 50,
            page: 1,
            lastPage: 5
          }
        }
      }
    })
    @ApiResponse({ status: 404, description: 'No se encontraron usuarios' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async findAll(
      @Param('page', ParseIntPipe) page: number,
      @Param('limit', ParseIntPipe) limit: number,
      @Req() req,
    ): Promise<ApiResponseCommon> {
      const cliente = req.user.cliente;
      const rol = req.user.rol;
      return await this.usuariosService.getAllUsuario(
        +cliente,
        +rol,
        page,
        limit,
      );
    }
  
    @Get(':id')
    @ApiOperation({ 
      summary: 'Obtener usuario por ID',
      description: 'Obtiene la información detallada de un usuario específico, incluyendo sus permisos asignados.'
    })
    @ApiParam({ name: 'id', description: 'ID del usuario', example: 1, type: Number })
    @ApiResponse({ 
      status: 200, 
      description: 'Usuario encontrado',
      schema: {
        example: {
          data: {
            usuario: [
              {
                id: 1,
                userName: 'usuario01',
                nombre: 'Juan',
                apellidoPaterno: 'Pérez',
                apellidoMaterno: 'López',
                telefono: '5512345678',
                estatus: 1,
                idRol: 2,
                rolNombre: 'Administrador',
                idCliente: 5
              }
            ],
            permiso: [
              {
                id: 1,
                idUsuario: 1,
                idPermiso: 5,
                estatus: 1
              }
            ]
          }
        }
      }
    })
    @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async findOne(@Param('id') id: number, @Req() req) {
      const cliente = req.user.cliente;
      const rol = req.user.rol;
      return this.usuariosService.getUsuarioByID(+id, +cliente, +rol);
    }
  
  
      // ========================================
  // 🔹 PUT ROUTES (actualización completa)
  // ========================================

  @Put('actualizar/contrasena/:id')
  @ApiOperation({ 
    summary: 'Cambiar contraseña de usuario',
    description: 'Actualiza la contraseña de un usuario. Requiere la contraseña actual y la nueva contraseña con confirmación.'
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 1, type: Number })
  @ApiBody({ type: UpdateUsuarioContrasena })
  @ApiResponse({ 
    status: 200, 
    description: 'Contraseña actualizada exitosamente',
    schema: {
      example: {
        status: 'success',
        message: 'Contraseña actualizada correctamente',
        data: {
          id: 1,
          nombre: 'Juan Pérez'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Contraseña inválida o credenciales incorrectas' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateContrasena(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioContrasena: UpdateUsuarioContrasena,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateContrasena(
      id,
      idUser,
      updateUsuarioContrasena,
    );
  }
  @Put(':id')
  @UseInterceptors(
    FileInterceptor('fotoPerfil', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10 MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new Error('Solo se permiten PNG, JPG o JPEG para foto de perfil'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Actualizar información completa del usuario',
    description: 'Actualiza la información de un usuario existente, incluyendo datos personales, rol, cliente y permisos. Puede incluir una nueva foto de perfil.'
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a actualizar', example: 1, type: Number })
  @ApiBody({ type: UpdateUsuarioDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario actualizado exitosamente',
    schema: {
      example: {
        status: 'success',
        message: 'Usuario actualizado correctamente',
        data: {
          id: 1,
          nombre: 'Juan Pérez'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o cliente inválido' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @UploadedFile() fotoPerfil: Express.Multer.File,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuario(
      id,
      updateUsuarioDto,
      idUser,
      fotoPerfil,
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({ 
    summary: 'Cambiar estatus del usuario (activar/desactivar)',
    description: 'Activa o desactiva un usuario cambiando su estatus. 1 = Activo, 0 = Inactivo.'
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 1, type: Number })
  @ApiBody({ type: UpdateUsuarioEstatusDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Estatus actualizado exitosamente',
    schema: {
      example: {
        status: 'success',
        message: 'Estatus usuario actualizado correctamente',
        estatus: {
          estatus: 1
        },
        data: {
          id: 1,
          nombre: 'Juan Pérez'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async changeUsuarioEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuarioEstatus(
      id,
      updateUsuarioEstatusDto,
      idUser,
    );
  }


  @Delete(':id')
  @ApiOperation({ 
    summary: 'Eliminar usuario',
    description: 'Elimina un usuario del sistema mediante eliminación lógica (cambia su estatus a 0).'
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a eliminar', example: 1, type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario eliminado exitosamente',
    schema: {
      example: {
        status: 'success',
        message: 'Usuario eliminado correctamente',
        data: {
          id: 1,
          nombre: 'Juan Pérez'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar el usuario' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async deleteUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.deleteUsuario(id, idUser);
  }
  
}