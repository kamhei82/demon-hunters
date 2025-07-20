class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.keys = {};
        this.mouse = { x: 0, y: 0, clicked: false };
        
        this.gameState = 'cutscene'; // cutscene, playing, paused, gameOver, levelComplete
        this.currentWave = 1;
        this.maxWaves = 3;
        this.score = 0;
        this.enemiesKilled = 0;
        
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.loot = [];
        
        this.lastTime = 0;
        this.deltaTime = 0;
        
        this.setupEventListeners();
        this.initializeGame();
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') e.preventDefault();
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.clicked = true;
            e.preventDefault();
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.mouse.clicked = false;
        });
    }
    
    initializeGame() {
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2, this);
        this.updateUI();
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('introCutscene').style.display = 'none';
        this.spawnWave();
        this.gameLoop();
    }
    
    spawnWave() {
        if (this.currentWave <= this.maxWaves) {
            const enemiesPerWave = 5;
            for (let i = 0; i < enemiesPerWave; i++) {
                setTimeout(() => {
                    this.spawnEnemy();
                }, i * 500);
            }
        } else {
            this.spawnBoss();
        }
    }
    
    spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (side) {
            case 0: // top
                x = Math.random() * this.canvas.width;
                y = -50;
                break;
            case 1: // right
                x = this.canvas.width + 50;
                y = Math.random() * this.canvas.height;
                break;
            case 2: // bottom
                x = Math.random() * this.canvas.width;
                y = this.canvas.height + 50;
                break;
            case 3: // left
                x = -50;
                y = Math.random() * this.canvas.height;
                break;
        }
        
        this.enemies.push(new StreetCrawler(x, y, this));
    }
    
    spawnBoss() {
        const boss = new AmpFiend(this.canvas.width / 2, 100, this);
        this.enemies.push(boss);
    }
    
    nextWave() {
        this.currentWave++;
        if (this.currentWave <= this.maxWaves) {
            this.spawnWave();
        } else if (this.enemies.length === 0) {
            this.spawnBoss();
        }
        this.updateUI();
    }
    
    gameLoop(currentTime = 0) {
        if (this.gameState !== 'playing') return;
        
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        this.update();
        this.render();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update() {
        if (this.player) {
            this.player.update();
        }
        
        this.enemies.forEach((enemy, index) => {
            enemy.update();
            if (enemy.isDead) {
                this.enemiesKilled++;
                this.score += enemy.scoreValue || 10;
                
                if (Math.random() < 0.3) {
                    this.spawnLoot(enemy.x, enemy.y);
                }
                
                this.enemies.splice(index, 1);
            }
        });
        
        this.projectiles.forEach((projectile, index) => {
            projectile.update();
            if (projectile.isDead) {
                this.projectiles.splice(index, 1);
            }
        });
        
        this.particles.forEach((particle, index) => {
            particle.update();
            if (particle.isDead) {
                this.particles.splice(index, 1);
            }
        });
        
        this.loot.forEach((lootItem, index) => {
            lootItem.update();
            if (lootItem.isDead) {
                this.loot.splice(index, 1);
            }
        });
        
        this.checkCollisions();
        this.checkWaveProgress();
        this.updateUI();
    }
    
    checkCollisions() {
        this.projectiles.forEach((projectile, pIndex) => {
            if (projectile.friendly) return;
            
            if (this.player && this.collision(projectile, this.player)) {
                this.player.takeDamage(projectile.damage);
                this.projectiles.splice(pIndex, 1);
            }
        });
        
        this.enemies.forEach((enemy, eIndex) => {
            this.projectiles.forEach((projectile, pIndex) => {
                if (!projectile.friendly) return;
                
                if (this.collision(projectile, enemy)) {
                    enemy.takeDamage(projectile.damage);
                    this.createParticles(projectile.x, projectile.y, '#ff00ff', 5);
                    this.projectiles.splice(pIndex, 1);
                }
            });
            
            if (this.player && this.collision(enemy, this.player)) {
                if (Date.now() - this.player.lastDamageTime > this.player.invulnerabilityTime) {
                    this.player.takeDamage(enemy.damage);
                }
            }
        });
        
        this.loot.forEach((lootItem, index) => {
            if (this.player && this.collision(lootItem, this.player)) {
                lootItem.collect(this.player);
                this.loot.splice(index, 1);
            }
        });
    }
    
    collision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    checkWaveProgress() {
        if (this.enemies.length === 0 && this.currentWave <= this.maxWaves) {
            setTimeout(() => {
                this.nextWave();
            }, 2000);
        } else if (this.enemies.length === 0 && this.currentWave > this.maxWaves) {
            this.levelComplete();
        }
    }
    
    spawnLoot(x, y) {
        const lootType = Math.random() < 0.8 ? 'health' : 'weapon';
        this.loot.push(new LootItem(x, y, lootType, this));
    }
    
    createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    
    render() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBackground();
        
        this.loot.forEach(lootItem => lootItem.render(this.ctx));
        this.particles.forEach(particle => particle.render(this.ctx));
        
        if (this.player) {
            this.player.render(this.ctx);
        }
        
        this.enemies.forEach(enemy => enemy.render(this.ctx));
        this.projectiles.forEach(projectile => projectile.render(this.ctx));
    }
    
    drawBackground() {
        const gridSize = 50;
        this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    updateUI() {
        if (this.player) {
            const healthPercent = (this.player.health / this.player.maxHealth) * 100;
            const staminaPercent = (this.player.stamina / this.player.maxStamina) * 100;
            
            document.getElementById('health-fill').style.width = healthPercent + '%';
            document.getElementById('health-text').textContent = `${Math.max(0, this.player.health)}/${this.player.maxHealth}`;
            
            document.getElementById('stamina-fill').style.width = staminaPercent + '%';
            document.getElementById('stamina-text').textContent = `${Math.max(0, this.player.stamina)}/${this.player.maxStamina}`;
            
            document.getElementById('current-weapon').textContent = this.player.weapon.name;
            document.getElementById('weapon-damage').textContent = this.player.weapon.damage;
        }
        
        document.getElementById('current-wave').textContent = `${Math.min(this.currentWave, this.maxWaves)}/${this.maxWaves}`;
        document.getElementById('score').textContent = this.score;
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('gameOver').style.display = 'flex';
    }
    
    levelComplete() {
        this.gameState = 'levelComplete';
        document.getElementById('level-score').textContent = this.score;
        document.getElementById('levelComplete').style.display = 'flex';
    }
}

class Player {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.game = game;
        
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        
        this.speed = 200;
        this.dashSpeed = 400;
        this.dashDuration = 0.2;
        this.dashCooldown = 1.0;
        this.isDashing = false;
        this.dashTime = 0;
        this.lastDashTime = 0;
        
        this.weapon = { name: 'Light Blade Mic', damage: 10 };
        this.attackCooldown = 0.5;
        this.lastAttackTime = 0;
        this.lastHeavyAttackTime = 0;
        this.heavyAttackCooldown = 1.0;
        this.aoeCooldown = 3.0;
        this.lastAoeTime = 0;
        
        this.invulnerabilityTime = 1000;
        this.lastDamageTime = 0;
        
        this.isDead = false;
    }
    
    update() {
        if (this.isDead) return;
        
        this.handleInput();
        this.updateStamina();
        this.constrainToCanvas();
        
        if (this.health <= 0) {
            this.isDead = true;
            this.game.gameOver();
        }
    }
    
    handleInput() {
        const keys = this.game.keys;
        const deltaTime = this.game.deltaTime;
        let moveX = 0, moveY = 0;
        
        if (keys['KeyW'] || keys['ArrowUp']) moveY = -1;
        if (keys['KeyS'] || keys['ArrowDown']) moveY = 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX = -1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX = 1;
        
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707;
            moveY *= 0.707;
        }
        
        if (keys['ShiftLeft'] && !this.isDashing && Date.now() - this.lastDashTime > this.dashCooldown * 1000 && this.stamina >= 20) {
            this.startDash();
        }
        
        if (this.isDashing) {
            this.dashTime += deltaTime;
            if (this.dashTime >= this.dashDuration) {
                this.isDashing = false;
                this.dashTime = 0;
            }
        }
        
        const currentSpeed = this.isDashing ? this.dashSpeed : this.speed;
        this.x += moveX * currentSpeed * deltaTime;
        this.y += moveY * currentSpeed * deltaTime;
        
        if (keys['Space'] && !keys['ShiftLeft'] && Date.now() - this.lastAttackTime > this.attackCooldown * 1000) {
            this.lightAttack();
        }
        
        if (keys['Space'] && keys['ShiftLeft'] && Date.now() - this.lastHeavyAttackTime > this.heavyAttackCooldown * 1000 && this.stamina >= 25) {
            this.heavyAttack();
        }
        
        if (keys['KeyQ'] && Date.now() - this.lastAoeTime > this.aoeCooldown * 1000 && this.stamina >= 30) {
            this.aoeAttack();
        }
    }
    
    startDash() {
        this.isDashing = true;
        this.dashTime = 0;
        this.lastDashTime = Date.now();
        this.stamina -= 20;
    }
    
    lightAttack() {
        this.lastAttackTime = Date.now();
        const angle = Math.atan2(this.game.mouse.y - (this.y + this.height/2), 
                                this.game.mouse.x - (this.x + this.width/2));
        
        const projectile = new Projectile(
            this.x + this.width/2,
            this.y + this.height/2,
            angle,
            300,
            this.weapon.damage,
            true,
            '#ff00ff',
            this.game
        );
        
        this.game.projectiles.push(projectile);
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ff00ff', 3);
    }
    
    heavyAttack() {
        this.lastHeavyAttackTime = Date.now();
        this.stamina -= 25;
        
        const angle = Math.atan2(this.game.mouse.y - (this.y + this.height/2), 
                                this.game.mouse.x - (this.x + this.width/2));
        
        const projectile = new Projectile(
            this.x + this.width/2,
            this.y + this.height/2,
            angle,
            400,
            this.weapon.damage * 2,
            true,
            '#ffff00',
            this.game
        );
        projectile.width = 15;
        projectile.height = 15;
        
        this.game.projectiles.push(projectile);
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ffff00', 8);
    }
    
    aoeAttack() {
        this.lastAoeTime = Date.now();
        this.stamina -= 30;
        
        this.game.enemies.forEach(enemy => {
            const distance = Math.sqrt((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2);
            if (distance < 100) {
                enemy.takeDamage(this.weapon.damage * 1.5);
                const knockbackAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                enemy.x += Math.cos(knockbackAngle) * 30;
                enemy.y += Math.sin(knockbackAngle) * 30;
            }
        });
        
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#00ffff', 20);
    }
    
    updateStamina() {
        if (this.stamina < this.maxStamina && !this.isDashing) {
            this.stamina += 50 * this.game.deltaTime;
            this.stamina = Math.min(this.stamina, this.maxStamina);
        }
    }
    
    constrainToCanvas() {
        this.x = Math.max(0, Math.min(this.x, this.game.canvas.width - this.width));
        this.y = Math.max(0, Math.min(this.y, this.game.canvas.height - this.height));
    }
    
    takeDamage(damage) {
        if (this.isDashing) return;
        
        this.health -= damage;
        this.lastDamageTime = Date.now();
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ff0000', 5);
    }
    
    render(ctx) {
        const isInvulnerable = Date.now() - this.lastDamageTime < this.invulnerabilityTime;
        
        if (isInvulnerable && Math.floor(Date.now() / 100) % 2) {
            ctx.globalAlpha = 0.5;
        }
        
        ctx.fillStyle = this.isDashing ? '#00ffff' : '#ff00ff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('RUMI', this.x + this.width/2, this.y - 5);
        
        ctx.globalAlpha = 1;
    }
}

class StreetCrawler {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 25;
        this.game = game;
        
        this.maxHealth = 30;
        this.health = this.maxHealth;
        this.speed = 80;
        this.damage = 5;
        this.scoreValue = 10;
        
        this.attackCooldown = 2000;
        this.lastAttackTime = 0;
        this.attackRange = 40;
        
        this.isDead = false;
    }
    
    update() {
        if (this.isDead || !this.game.player) return;
        
        this.moveTowardsPlayer();
        this.checkAttack();
        
        if (this.health <= 0) {
            this.isDead = true;
        }
    }
    
    moveTowardsPlayer() {
        const player = this.game.player;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.attackRange) {
            const moveX = (dx / distance) * this.speed * this.game.deltaTime;
            const moveY = (dy / distance) * this.speed * this.game.deltaTime;
            
            this.x += moveX;
            this.y += moveY;
        }
    }
    
    checkAttack() {
        if (!this.game.player) return;
        
        const player = this.game.player;
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (distance <= this.attackRange && Date.now() - this.lastAttackTime > this.attackCooldown) {
            this.attack();
        }
    }
    
    attack() {
        this.lastAttackTime = Date.now();
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ff0000', 3);
    }
    
    takeDamage(damage) {
        this.health -= damage;
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ffffff', 3);
    }
    
    render(ctx) {
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x, this.y - 8, this.width * healthPercent, 4);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(this.x, this.y - 8, this.width, 4);
    }
}

class AmpFiend {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
        this.game = game;
        
        this.maxHealth = 300;
        this.health = this.maxHealth;
        this.speed = 60;
        this.damage = 15;
        this.scoreValue = 100;
        
        this.phase = 1;
        this.attackCooldown = 3000;
        this.lastAttackTime = 0;
        
        this.isDead = false;
    }
    
    update() {
        if (this.isDead || !this.game.player) return;
        
        this.updatePhase();
        this.moveTowardsPlayer();
        this.checkAttack();
        
        if (this.health <= 0) {
            this.isDead = true;
            this.dropLoot();
        }
    }
    
    updatePhase() {
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent <= 0.4 && this.phase < 3) {
            this.phase = 3;
        } else if (healthPercent <= 0.7 && this.phase < 2) {
            this.phase = 2;
        }
    }
    
    moveTowardsPlayer() {
        const player = this.game.player;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 60) {
            const moveX = (dx / distance) * this.speed * this.game.deltaTime;
            const moveY = (dy / distance) * this.speed * this.game.deltaTime;
            
            this.x += moveX;
            this.y += moveY;
        }
    }
    
    checkAttack() {
        if (Date.now() - this.lastAttackTime > this.attackCooldown) {
            this.performPhaseAttack();
        }
    }
    
    performPhaseAttack() {
        this.lastAttackTime = Date.now();
        
        switch (this.phase) {
            case 1:
                this.stompAttack();
                break;
            case 2:
                this.summonAttack();
                break;
            case 3:
                this.overloadAttack();
                break;
        }
    }
    
    stompAttack() {
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ffff00', 15);
        
        if (this.game.player) {
            const distance = Math.sqrt((this.game.player.x - this.x) ** 2 + (this.game.player.y - this.y) ** 2);
            if (distance < 100) {
                this.game.player.takeDamage(this.damage);
            }
        }
    }
    
    summonAttack() {
        for (let i = 0; i < 2; i++) {
            const angle = (Math.PI * 2 * i) / 2;
            const spawnX = this.x + Math.cos(angle) * 60;
            const spawnY = this.y + Math.sin(angle) * 60;
            
            this.game.enemies.push(new StreetCrawler(spawnX, spawnY, this.game));
        }
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ff00ff', 10);
    }
    
    overloadAttack() {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const projectile = new Projectile(
                this.x + this.width/2,
                this.y + this.height/2,
                angle,
                200,
                this.damage,
                false,
                '#ffff00',
                this.game
            );
            this.game.projectiles.push(projectile);
        }
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ffff00', 20);
    }
    
    dropLoot() {
        this.game.loot.push(new LootItem(this.x, this.y, 'epic_weapon', this.game));
    }
    
    takeDamage(damage) {
        this.health -= damage;
        this.game.createParticles(this.x + this.width/2, this.y + this.height/2, '#ffffff', 5);
    }
    
    render(ctx) {
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('AMP', this.x + this.width/2, this.y + this.height/2 + 3);
        
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x, this.y - 12, this.width * healthPercent, 6);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(this.x, this.y - 12, this.width, 6);
    }
}

class Projectile {
    constructor(x, y, angle, speed, damage, friendly, color, game) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.friendly = friendly;
        this.color = color;
        this.game = game;
        
        this.width = 8;
        this.height = 8;
        this.isDead = false;
        
        this.velocityX = Math.cos(angle) * speed;
        this.velocityY = Math.sin(angle) * speed;
    }
    
    update() {
        this.x += this.velocityX * this.game.deltaTime;
        this.y += this.velocityY * this.game.deltaTime;
        
        if (this.x < -50 || this.x > this.game.canvas.width + 50 ||
            this.y < -50 || this.y > this.game.canvas.height + 50) {
            this.isDead = true;
        }
    }
    
    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class LootItem {
    constructor(x, y, type, game) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.game = game;
        this.width = 20;
        this.height = 20;
        this.isDead = false;
        
        this.bobOffset = Math.random() * Math.PI * 2;
        this.time = 0;
    }
    
    update() {
        this.time += this.game.deltaTime;
        this.y += Math.sin(this.time * 3 + this.bobOffset) * 0.5;
    }
    
    collect(player) {
        switch (this.type) {
            case 'health':
                player.health = Math.min(player.maxHealth, player.health + 30);
                break;
            case 'weapon':
                player.weapon = { name: 'Enhanced Mic', damage: player.weapon.damage + 2 };
                break;
            case 'epic_weapon':
                player.weapon = { name: 'Bass Blade', damage: player.weapon.damage + 10 };
                this.game.score += 50;
                break;
        }
        
        this.game.createParticles(this.x, this.y, this.getColor(), 8);
    }
    
    getColor() {
        switch (this.type) {
            case 'health': return '#00ff00';
            case 'weapon': return '#0088ff';
            case 'epic_weapon': return '#ff8800';
            default: return '#ffffff';
        }
    }
    
    render(ctx) {
        ctx.fillStyle = this.getColor();
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.shadowColor = this.getColor();
        ctx.shadowBlur = 15;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocityX = (Math.random() - 0.5) * 200;
        this.velocityY = (Math.random() - 0.5) * 200;
        this.life = 1.0;
        this.decay = Math.random() * 2 + 1;
        this.size = Math.random() * 4 + 2;
        this.isDead = false;
    }
    
    update() {
        this.x += this.velocityX * 0.016;
        this.y += this.velocityY * 0.016;
        this.life -= this.decay * 0.016;
        
        if (this.life <= 0) {
            this.isDead = true;
        }
    }
    
    render(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

let game;

function startGame() {
    if (!game) {
        game = new Game();
    }
    game.startGame();
}

function restartGame() {
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('levelComplete').style.display = 'none';
    game = new Game();
    game.startGame();
}

window.addEventListener('load', () => {
    game = new Game();
});