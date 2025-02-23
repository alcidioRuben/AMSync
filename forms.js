
// Adicionar formatação de moeda
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-MZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' MT';
}


// Remover a animação inicial dos valores
document.addEventListener('DOMContentLoaded', () => {
    carregarDadosUsuario();
    adicionarBotaoLogout();
    carregarVendas();
    carregarTabelaComissoes();
    configurarGrafico();
    gerenciarBotaoVoltarTopo();
});

// Função para animar valor monetário
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString('pt-MZ') + ' MT';
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Nova função para animar valor percentual
function animateMetaValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start) + '%';
        
        // Adicionar efeito de cor baseado no progresso
        const hue = (progress * (end - start) + start) > 70 ? 120 : 0; // Verde se > 70%, vermelho se < 70%
        obj.style.color = `hsl(${hue}, 50%, 45%)`;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Animação ao scroll
function animateOnScroll() {
    const elements = document.querySelectorAll('.card');
    elements.forEach(element => {
        const position = element.getBoundingClientRect();
        if(position.top < window.innerHeight) {
            element.style.animation = 'pulseCard 1s ease';
        }
    });
}

window.addEventListener('scroll', animateOnScroll);

// Função para calcular comissão baseada nos megas
function calcularComissao(megasVendidos, valorVenda) {
    // Valor por MB = 2 MT / 1024 MB = 0.001953125 MT/MB
    const valorPorMB = 2 / 1024;  // aproximadamente 0.001953125 MT por MB
    
    // Calcular comissão total baseada nos megas vendidos
    const comissaoTotal = megasVendidos * valorPorMB;
    
    // Log para debug
    console.log('Cálculo da comissão:', {
        megasVendidos,
        valorPorMB: valorPorMB.toFixed(9),
        comissaoTotal: comissaoTotal.toFixed(2)
    });
    
    return comissaoTotal;
}

// Função para exibir o modal e esperar a confirmação do usuário
function esperarConfirmacaoModal(modalId, botaoId) {
    return new Promise(resolve => {
        const modal = document.getElementById(modalId);
        modal.classList.add('show'); // Mostrar o modal

        // Evento no botão "Entendido" para fechar o modal e resolver a Promise
        document.getElementById(botaoId).addEventListener('click', () => {
            modal.classList.remove('show'); // Ocultar o modal
            resolve(); // Continua a execução depois que o usuário clicar "OK"
        }, { once: true }); // Garante que o evento será executado apenas uma vez
    });
}


// Função para exibir e aguardar a confirmação do usuário no modal
function esperarConfirmacaoModal(modalId, botaoId) {
    return new Promise(resolve => {
        const modal = document.getElementById(modalId);
        const botao = document.getElementById(botaoId);

        if (!modal || !botao) {
            console.error(`Erro: Modal ou botão não encontrados (${modalId}, ${botaoId})`);
            resolve();
            return;
        }

        modal.classList.add('show'); // Mostrar modal

        // Adiciona um evento de clique que será removido após a interação
        const fecharModal = () => {
            modal.classList.remove('show'); // Fechar modal
            resolve(); // Continua a execução do código
            botao.removeEventListener('click', fecharModal); // Remove o evento após um clique
        };

        botao.addEventListener('click', fecharModal, { once: true }); // Garante que só será executado uma vez
    });
}
// Exibir modal de erro para número inexistente
function mostrarModalNumero() {
    return esperarConfirmacaoModal('modal-numero', 'modal-ok2');
}

// Exibir modal de erro para saldo insuficiente
function mostrarModalSaldo() {
    return esperarConfirmacaoModal('modal-saldo', 'modal-ok1');
}

// Exibir modal de erro para valor incorreto
function mostrarModalValor() {
    return esperarConfirmacaoModal('modal-valor', 'modal-ok3');
}

// Função para salvar transação verificando se o número existe na coleção 'clientes'
function salvarTransacao(dados) {
    const user = auth.currentUser;
    if (!user) return Promise.reject('Usuário não autenticado');

    console.log("Verificando número do cliente:", dados.numeroCliente);

    return db.collection('Clientes') // Verifica na coleção 'Clientes'
        .where("Numero", "==", dados.numeroCliente)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                return mostrarModalNumero().then(() => Promise.reject("Número do cliente não existe."));
            }

            // Obtém o primeiro documento correspondente
            const clienteDoc = snapshot.docs[0];
            const clienteData = clienteDoc.data();

            // Verifica se o valor também corresponde
            if (clienteData.valor !== dados.valor) {
                return mostrarModalValor().then(() => Promise.reject("Valor não corresponde ao registrado."));
            }

            // Obter dados do usuário antes de salvar a transação
            return db.collection('usuarios').doc(user.uid).get()
                .then((doc) => {
                    if (!doc.exists) {
                        return Promise.reject("Usuário não encontrado no Firestore.");
                    }

                    const userData = doc.data();
                    const saldoAtual = userData.saldo || 0;
                    const novoSaldo = saldoAtual - dados.megasVendidos;

                    // Verificar se o saldo é suficiente
                    if (novoSaldo < 0) {
                        return mostrarModalSaldo().then(() => Promise.reject("Saldo insuficiente para completar a transação."));
                    }

                    const valorPorMB = 2 / 1024; // aprocimadamente a 
                    const comissaoBase = dados.megasVendidos * valorPorMB;

                    // Criar objeto da transação
                    const transacao = {
                        numeroCliente: dados.numeroCliente,
                        megasVendidos: parseInt(dados.megasVendidos),
                        valor: parseFloat(dados.valor),
                        comissaoBase: comissaoBase,
                        data: dados.data,
                        userId: user.uid,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    };

                    // Salvar transação e atualizar o saldo e outros valores do usuário
                    return db.collection('transacoes').add(transacao)
                        .then(() => {
                            // Atualizar saldo e vendas do usuário
                            return db.collection('usuarios').doc(user.uid).update({
                                saldo: novoSaldo,
                                totalVendas: firebase.firestore.FieldValue.increment(dados.valor),
                                totalMegas: firebase.firestore.FieldValue.increment(dados.megasVendidos),
                                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        })
                        .then(() => {
                            // Remover o documento do cliente após a transação ser concluída
                            return db.collection('Clientes').doc(clienteDoc.id).delete();
                        });
                });
        })
        .then(() => {
            console.log("Transação concluída e número removido.");
            carregarDadosUsuario();
            carregarVendas();
            carregarTabelaComissoes();
            setTimeout(() => configurarGrafico(), 100);
        })
        .catch((error) => {
            console.error('Erro ao salvar transação:', error);
            // Removido alert() para evitar conflitos com os modais
        });
}



// Capturar evento de submissão do formulário
document.getElementById('transacaoForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const dados = {
        numeroCliente: this.querySelector('[name="numeroCliente"]').value.trim().replace(/\s+/g, ''), // 🔹 Remove espaços
        megasVendidos: parseInt(this.querySelector('[name="megasVendidos"]').value.trim().replace(/\s+/g, '')), // 🔹 Remove espaços
        valor: parseFloat(this.querySelector('[name="valor"]').value),
        data: this.querySelector('[name="data"]').value
    };

    console.log('Número formatado antes de enviar:', `"${dados.numeroCliente}"`);
    console.log('Valor formatado antes de enviar:', `"${dados.valor}"`);

    if (!dados.numeroCliente || isNaN(dados.megasVendidos) || dados.megasVendidos <= 0) {
        alert('Erro: Verifique o número do cliente e a quantidade de megas.');
        return;
    }

    if (isNaN(dados.valor) || dados.valor <= 0) {
        alert('Erro: Insira um valor válido.');
        return;
    }

    const button = this.querySelector('button');
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';

    try {
        await verificarCliente(dados.numeroCliente);
        await verificarSaldo(dados.megasVendidos);
        await verificarValor(dados.valor);

        await salvarTransacao(dados);
        this.reset();

        const alert = document.createElement('div');
        alert.className = 'alert alert-success mt-3 animate__animated animate__fadeIn';
        const adicionalComissao = dados.megasVendidos < 5000 ? 2 : 8;
        alert.innerHTML = `
            Transação salva com sucesso!<br>
            <small>
                Valor da Venda: ${dados.valor} MT<br>
                Adicional por Megas: +${adicionalComissao} MT<br>
                Total: ${(dados.valor + adicionalComissao).toFixed(2)} MT
            </small>
        `;
        this.appendChild(alert);

        carregarVendas();

        setTimeout(() => {
            alert.remove();
            button.disabled = false;
            button.innerHTML = 'Salvar Transação';
        }, 3000);
    } catch (error) {
        console.error('Erro ao salvar:', error);
        const alertSuccess = document.querySelector('.alert-success');
        if (alertSuccess) {
            alertSuccess.remove();
        }
        button.disabled = false;
        button.innerHTML = 'Salvar Transação';
    }
});


// 🔹 Função para verificar se o cliente existe no banco de dados
async function verificarCliente(numeroCliente) {
    const snapshot = await db.collection('Clientes').where("Numero", "==", numeroCliente).get();
    if (snapshot.empty) {
        await mostrarModalNumero();
        throw new Error("Número do cliente não existe.");
    }
}

// 🔹 Função para verificar se o saldo é suficiente
async function verificarSaldo(megasVendidos) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado.");

    const doc = await db.collection('usuarios').doc(user.uid).get();
    if (!doc.exists) throw new Error("Usuário não encontrado no Firestore.");

    const userData = doc.data();
    const saldoAtual = userData.saldo || 0;
    const novoSaldo = saldoAtual - megasVendidos;

    if (novoSaldo < 0) {
        await mostrarModalSaldo();
        throw new Error("Saldo insuficiente para completar a transação.");
    }
}

// 🔹 Função para verificar se o valor informado bate com o registrado no banco
async function verificarValor(valor) {
    // Aqui pode adicionar uma verificação se o valor deve ser compatível com algum registro específico
    // Caso precise, verifique na coleção 'Clientes' ou 'transacoes' se o valor inserido está correto.
    return;
}

// Função para atualizar dados do usuário
function atualizarDadosUsuario(transacao) {
    const user = auth.currentUser;
    if (!user) return Promise.reject('Usuário não autenticado');

    return db.collection('usuarios').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                const novosDados = {
                    totalVendas: (userData.totalVendas || 0) + transacao.valor,
                    totalMegas: (userData.totalMegas || 0) + transacao.megasVendidos,
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                };

                return db.collection('usuarios').doc(user.uid).update(novosDados)
                    .then(() => {
                        carregarVendas();
                        carregarTabelaComissoes();
                        setTimeout(() => configurarGrafico(), 100);
                    });
            }
        });
}

// Adicionar animação de hover para ambos os cards
document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        const value = this.querySelector('.stat-value');
        value.style.transform = 'scale(1.1)';
        value.style.transition = 'transform 0.3s ease';
    });

    card.addEventListener('mouseleave', function() {
        const value = this.querySelector('.stat-value');
        value.style.transform = 'scale(1)';
    });
});

// Adiciona swipe para tabelas em mobile
document.querySelectorAll('.mobile-scroll').forEach(table => {
    let startX;
    let scrollLeft;

    table.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - table.offsetLeft;
        scrollLeft = table.scrollLeft;
    });

    table.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const x = e.touches[0].pageX - table.offsetLeft;
        const walk = (x - startX) * 2;
        table.scrollLeft = scrollLeft - walk;
    });
});


// Inicializar serviços do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Função para registrar o usuário e salvar no Firestore
function registrarUsuario(nome, email, senha) {
    auth.createUserWithEmailAndPassword(email, senha)
        .then(user => {
            db.collection('usuarios').doc(user.uid).set({ nome: nome });
            console.log('Usuário registrado com sucesso:', user);
            // adicionar usuario na navbar
            document.querySelector('.user-name').textContent = nome;
        })
        .catch(error => {
            console.error('Erro ao registrar usuário:', error);
        });
}

// Atualizar a função carregarDadosUsuario
function carregarDadosUsuario() {
    const user = auth.currentUser;
    if (user) {
        // Primeiro buscar dados do usuário
        db.collection('usuarios').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();

                    // Atualizar o nome na navbar baseado na hora do dia
                    const hora = new Date().getHours();
                    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
                    const userInfo = document.createElement('div');
                    userInfo.className = 'user-info animate__animated animate__fadeIn';
                    userInfo.innerHTML = `
                        <span class="welcome-text">${saudacao},</span>
                        <span class="user-name">${userData.nome}</span>
                    `;
                    
                    const navbar = document.querySelector('.navbar .container');
                    if (navbar.querySelector('.user-info')) {
                        navbar.querySelector('.user-info').remove();
                    }
                    navbar.insertBefore(userInfo, navbar.lastChild);

                    // Buscar todas as transações do usuário para calcular comissão e meta
                    db.collection('transacoes')
                        .where('userId', '==', user.uid)
                        .get()
                        .then(transacoes => {
                            let totalVendas = 0;
                            let totalComissaoBase = 0;

                            transacoes.forEach(doc => {
                                const transacao = doc.data();
                                totalVendas += transacao.valor;
                                totalComissaoBase += transacao.megasVendidos < 5000 ? 2 : 8;
                            });

                            // Calcular bônus (10% extra se vendas > 40000)
                            const bonus = totalVendas > 40000 ? totalComissaoBase * 0.1 : 0;
                            const comissaoTotal = totalComissaoBase + bonus;

                            // Meta mensal de vendas (50000 MT)
                            const metaMensal = 50000;
                            const percentualMeta = Math.min((totalVendas / metaMensal) * 100, 100);

                            // Atualizar valor da comissão
                            const comissaoElement = document.querySelector('.stat-value');
                            if (comissaoElement) {
                                comissaoElement.classList.remove('loading');
                                comissaoElement.innerHTML = `${comissaoTotal.toFixed(2)} MT`;
                                comissaoElement.classList.add('animate__animated', 'animate__fadeIn');
                            }

                            const saldoElement = document.getElementById('saldo-value');
                            if (saldoElement) {
                                saldoElement.textContent = `Saldo: ${userData.saldo?.toFixed(0) || '0.00'} MB`;
                                saldoElement.classList.remove('loading-placeholder');
                            }


                            // Atualizar meta
                            const metaElement = document.querySelectorAll('.stat-value')[1];
                            if (metaElement) {
                                metaElement.classList.remove('loading');
                                metaElement.innerHTML = `${percentualMeta.toFixed(0)}%`;
                                
                                // Cor baseada no progresso
                                if (percentualMeta >= 90) {
                                    metaElement.style.color = '#28a745'; // Verde
                                } else if (percentualMeta >= 70) {
                                    metaElement.style.color = '#ffc107'; // Amarelo
                                } else if (percentualMeta >= 50) {
                                    metaElement.style.color = '#fd7e14'; // Laranja
                                } else {
                                    metaElement.style.color = '#dc3545'; // Vermelho
                                }
                                
                                metaElement.classList.add('animate__animated', 'animate__fadeIn');
                            }

                            // Atualizar dados no Firestore
                            db.collection('usuarios').doc(user.uid).update({
                                totalVendas: totalVendas,
                                comissaoBase: totalComissaoBase,
                                bonus: bonus,
                                comissaoTotal: comissaoTotal,
                                percentualMeta: percentualMeta,
                                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        });
                }
            })
            .catch(error => {
                console.error("Erro ao carregar dados do usuário:", error);
                const comissaoElement = document.querySelector('.stat-value');
                if (comissaoElement) {
                    comissaoElement.classList.remove('loading');
                    comissaoElement.innerHTML = '0.00 MT';
                }
                
                const metaElement = document.querySelectorAll('.stat-value')[1];
                if (metaElement) {
                    metaElement.classList.remove('loading');
                    metaElement.innerHTML = '0%';
                    metaElement.style.color = '#dc3545';
                }
            });
    }
}

// Função para fazer logout
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Erro ao fazer logout:', error);
    });
}

// Adicionar botão de logout na navbar
function adicionarBotaoLogout() {
    const navbar = document.querySelector('.navbar .container');
    const logoutButton = document.createElement('button');
    logoutButton.className = 'btn btn-outline-light ms-3 animate__animated animate__fadeIn';
    logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
    logoutButton.onclick = logout;
    navbar.appendChild(logoutButton);
}

// Verificar autenticação
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        carregarDadosUsuario(); // Recarregar dados quando o estado de autenticação mudar
    }
});

// Função para controlar o botão Voltar ao Topo
function gerenciarBotaoVoltarTopo() {
    const btnVoltarTopo = document.getElementById('btnVoltarTopo');
    
    // Mostrar/ocultar botão baseado na posição do scroll
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            btnVoltarTopo.classList.add('visible');
        } else {
            btnVoltarTopo.classList.remove('visible');
        }
    });

    // Evento de clique para voltar ao topo
    btnVoltarTopo.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Adicionar suporte a gestos de toque
    let touchstartY = 0;
    let touchendY = 0;

    document.addEventListener('touchstart', e => {
        touchstartY = e.changedTouches[0].screenY;
    });

    document.addEventListener('touchend', e => {
        touchendY = e.changedTouches[0].screenY;
        if (touchendY < touchstartY && window.pageYOffset > 300) {
            // Swipe para cima - mostrar botão
            btnVoltarTopo.classList.add('visible');
        } else if (touchendY > touchstartY && window.pageYOffset < 100) {
            // Swipe para baixo no topo - ocultar botão
            btnVoltarTopo.classList.remove('visible');
        }
    });
}

// Função para carregar vendas
function carregarVendas(filtro = 'all') {
    const container = document.getElementById('vendas-container');
    container.innerHTML = '<div class="text-center"><div class="spinner-border text-vodacom"></div></div>';

    db.collection('transacoes')
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => {
            container.innerHTML = '';

            if (snapshot.empty) {
                // Se não houver transações, mostrar mensagem
                container.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-inbox fa-3x mb-3"></i>
                        <p>Nenhuma venda encontrada</p>
                    </div>
                `;
                return;
            }

            // Coletar todas as promessas para buscar nomes dos usuários
            const promessas = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.timestamp.toDate();

                // Aplicar filtros
                if (filtro === 'today' && !isToday(date)) return;
                if (filtro === 'week' && !isThisWeek(date)) return;

                // Adicionar promessa para buscar nome do usuário
                const promessa = db.collection('usuarios').doc(data.userId).get()
                    .then(userDoc => {
                        const userData = userDoc.exists ? userDoc.data() : {};
                        const nomeUsuario = userData.nome || 'Usuário desconhecido';
                        const card = criarCardVenda(data, nomeUsuario, date);
                        container.appendChild(card);

                        // Animar entrada
                        card.classList.add('animate__animated', 'animate__fadeIn');
                    })
                    .catch(error => {
                        console.error(`Erro ao buscar usuário com ID ${data.userId}:`, error);
                    });

                promessas.push(promessa);
            });

            // Aguardar todas as promessas serem resolvidas
            Promise.all(promessas).then(() => {
                // Se o contêiner ainda estiver vazio após todas as promessas, mostrar mensagem
                if (container.children.length === 0) {
                    container.innerHTML = `
                        <div class="text-center text-muted">
                            <i class="fas fa-inbox fa-3x mb-3"></i>
                            <p>Nenhuma venda encontrada</p>
                        </div>
                    `;
                }
            });
        })
        .catch(error => {
            console.error("Erro ao carregar transações:", error);
            container.innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                    <p>Erro ao carregar vendas. Por favor, tente novamente.</p>
                </div>
            `;
        });
}

// Função para criar card de venda
function criarCardVenda(data, nomeVendedor, date) {
    const card = document.createElement('div');
    card.className = 'venda-card';
    card.innerHTML = `
        <div class="venda-header">
            <strong>${nomeVendedor}</strong>
            <span class="venda-data">${formatarData(date)}</span>
        </div>
        <div class="venda-info">
            <div class="venda-item">
                <div class="venda-label">Megas</div>
                <div class="venda-valor">${data.megasVendidos} MB</div>
            </div>
            <div class="venda-item">
                <div class="venda-label">Valor</div>
                <div class="venda-valor">${data.valor.toFixed(2)} MT</div>
            </div>
        </div>
    `;
    return card;
}

// Funções auxiliares
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function isThisWeek(date) {
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    return date >= weekStart;
}

function formatarData(date) {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Adicionar eventos aos botões de filtro
document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', (e) => {
        // Remover classe active de todos os botões
        document.querySelectorAll('[data-filter]').forEach(btn => 
            btn.classList.remove('active'));
        
        // Adicionar classe active ao botão clicado
        e.target.classList.add('active');
        
        // Carregar vendas com o filtro selecionado
        carregarVendas(e.target.dataset.filter);
    });
});

// Função para carregar tabela de comissões para pagamento
function carregarTabelaComissoes() {
    const tbody = document.querySelector('.comissao-table tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4"><div class="spinner-border text-vodacom"></div></td></tr>';

    db.collection('usuarios')
        .get()
        .then(snapshot => {
            tbody.innerHTML = '';
            const vendedores = [];

            // Primeiro coletar todos os dados
            const promessas = snapshot.docs.map(userDoc => {
                const userData = userDoc.data();
                return db.collection('transacoes')
                    .where('userId', '==', userDoc.id)
                    .get()
                    .then(transacoes => {
                        let totalVendas = 0;
                        let totalMegas = 0;
                        let comissaoBase = 0;

                        transacoes.forEach(doc => {
                            const transacao = doc.data();
                            totalVendas += transacao.valor;
                            totalMegas += transacao.megasVendidos;
                            comissaoBase += transacao.megasVendidos < 5000 ? 2 : 8;
                        });

                        vendedores.push({
                            nome: formatarNome(userData.nome || 'Usuário ' + userDoc.id),
                            totalVendas,
                            totalMegas,
                            comissaoBase,
                            bonus: totalVendas > 40000 ? comissaoBase * 0.1 : 0,
                            nomeCompleto: userData.nome // Manter nome completo para tooltip
                        });
                    });
            });

            // Depois de coletar todos os dados, ordenar e renderizar
            Promise.all(promessas).then(() => {
                // Ordenar por total a receber
                vendedores.sort((a, b) => 
                    (b.comissaoBase + b.bonus) - (a.comissaoBase + a.bonus)
                );

                // Renderizar dados ordenados
                vendedores.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.className = v.totalVendas > 40000 ? 'comissao-destaque' : '';
                    tr.innerHTML = `
                        <td>
                            <div class="d-flex align-items-center" title="${v.nomeCompleto}">
                                ${v.totalVendas > 40000 ? '<span class="vendedor-badge">🏆</span>' : ''}
                                <span class="fw-bold">${v.nome}</span>
                            </div>
                        </td>
                        <td>${v.totalMegas.toLocaleString('pt-MZ')} MB</td>
                        <td>${v.totalVendas.toLocaleString('pt-MZ')} MT</td>
                        <td>${v.comissaoBase.toLocaleString('pt-MZ')} MT</td>
                        <td class="bonus-value">
                            ${v.bonus > 0 ? '+' + v.bonus.toLocaleString('pt-MZ') + ' MT' : '-'}
                        </td>
                        <td class="total-value">
                            ${(v.comissaoBase + v.bonus).toLocaleString('pt-MZ')} MT
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            });
        })
        .catch(error => {
            console.error('Erro ao carregar comissões:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger p-4">
                        Erro ao carregar dados. Por favor, tente novamente.
                    </td>
                </tr>
            `;
        });
}

// Variável global para armazenar a instância do gráfico
let vendasChart = null;

// Função para carregar e configurar o gráfico
function configurarGrafico() {
    const ctx = document.getElementById('vendasChart').getContext('2d');

    // Destruir gráfico anterior se existir
    if (vendasChart) {
        vendasChart.destroy();
    }

    // Mostrar loading
    ctx.canvas.style.opacity = '0.5';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-center';
    loadingDiv.innerHTML = '<div class="spinner-border text-vodacom"></div>';
    ctx.canvas.parentNode.appendChild(loadingDiv);

    // Buscar dados dos usuários
    db.collection('usuarios')
        .get()
        .then(async snapshot => {
            const vendedores = [];
            
            // Coletar dados de cada vendedor
            for (const doc of snapshot.docs) {
                const userData = doc.data();
                const transacoes = await db.collection('transacoes')
                    .where('userId', '==', doc.id)
                    .get();

                let totalVendas = 0;
                transacoes.forEach(t => {
                    totalVendas += t.data().valor;
                });

                vendedores.push({
                    nome: formatarNome(userData.nome || 'Usuário ' + doc.id),
                    nomeCompleto: userData.nome || 'Usuário ' + doc.id,
                    totalVendas: totalVendas
                });
            }

            // Ordenar por valor de vendas
            vendedores.sort((a, b) => b.totalVendas - a.totalVendas);

            // Remover loading
            loadingDiv.remove();
            ctx.canvas.style.opacity = '1';

            // Criar novo gráfico e armazenar na variável global
            vendasChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: vendedores.map(v => v.nome),
                    datasets: [{
                        label: 'Vendas (MT)',
                        data: vendedores.map(v => v.totalVendas),
                        backgroundColor: function(context) {
                            const index = context.dataIndex;
                            const value = context.dataset.data[index];
                            const max = Math.max(...context.dataset.data);
                            
                            if (value === max) {
                                return 'rgba(40, 167, 69, 0.8)'; // Verde para o melhor
                            } else if (value >= max * 0.75) {
                                return 'rgba(230, 0, 0, 0.8)'; // Vermelho Vodacom para bom
                            } else if (value >= max * 0.5) {
                                return 'rgba(255, 193, 7, 0.8)'; // Amarelo para médio
                            } else {
                                return 'rgba(108, 117, 125, 0.6)'; // Cinza para regular
                            }
                        },
                        borderColor: function(context) {
                            const index = context.dataIndex;
                            const value = context.dataset.data[index];
                            const max = Math.max(...context.dataset.data);
                            
                            if (value === max) {
                                return 'rgb(40, 167, 69)';
                            } else if (value >= max * 0.75) {
                                return 'rgb(230, 0, 0)';
                            } else if (value >= max * 0.5) {
                                return 'rgb(255, 193, 7)';
                            } else {
                                return 'rgb(108, 117, 125)';
                            }
                        },
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    animation: {
                        duration: 2000,
                        easing: 'easeInOutQuart'
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString('pt-MZ') + ' MT';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    // Mostrar nome completo no tooltip
                                    return vendedores[context[0].dataIndex].nomeCompleto;
                                },
                                label: function(context) {
                                    const value = context.raw;
                                    const max = Math.max(...context.dataset.data);
                                    let status = '';
                                    
                                    if (value === max) {
                                        status = '🏆 Melhor Vendedor';
                                    } else if (value >= max * 0.75) {
                                        status = '⭐ Ótimo Desempenho';
                                    } else if (value >= max * 0.5) {
                                        status = '👍 Bom Desempenho';
                                    } else {
                                        status = '📊 Desempenho Regular';
                                    }
                                    
                                    return [
                                        'Vendas: ' + value.toLocaleString('pt-MZ') + ' MT',
                                        status
                                    ];
                                }
                            }
                        }
                    }
                }
            });
        })
        .catch(error => {
            console.error('Erro ao carregar dados:', error);
            loadingDiv.innerHTML = '<div class="alert alert-danger">Erro ao carregar dados</div>';
        });
}

// Função para formatar nome (pegar apenas primeiro nome)
function formatarNome(nomeCompleto) {
    if (!nomeCompleto) return 'Usuário';
    // Pegar apenas o primeiro nome
    return nomeCompleto.split(' ')[0];
}


// Função para exibir um modal e aguardar a confirmação do usuário
function esperarConfirmacaoModal(modalId, botaoId) {
    return new Promise(resolve => {
        const modal = document.getElementById(modalId);
        modal.classList.add('show'); // Mostrar o modal

        const botao = document.getElementById(botaoId);

        // Remover eventos antigos e adicionar um novo evento
        botao.removeEventListener('click', fecharModal);
        botao.addEventListener('click', fecharModal, { once: true });

        function fecharModal() {
            modal.classList.remove('show'); // Ocultar o modal
            resolve(); // Permitir que a execução continue
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    // Capturar o input de data
    const dataInput = document.getElementById("dataInput");
    
    // Obter data atual no formato YYYY-MM-DD
    const hoje = new Date().toISOString().split('T')[0];
    
    // Definir a data atual no campo
    dataInput.value = hoje;
});

