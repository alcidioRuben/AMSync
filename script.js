// Instanciar os serviços
const auth = firebase.auth();
const db = firebase.firestore();



// Função de login e cadastro de usuários

function loginUser(email, password) {
    const nomeUsuario = document.getElementById("nome").value;
    const telefoneUsuario = document.getElementById("numero").value;

    // Criar o usuário no Firebase Authentication
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;

            

            // Salvar os dados do usuário no Firestore
           
            return db.collection("usuarios").doc(user.uid).set({
                nome: nomeUsuario,
                email: email,
                telefone: telefoneUsuario,
                dataCadastro: firebase.firestore.FieldValue.serverTimestamp(),
                totalVendas: 0,
                totalMegas: 0,
                comissaoBase: 0,
                bonus: 0,
                comissaoTotal: 0,
                percentualMeta: 0,
                saldo: 0,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                
                window.location.href = "forms.html"; // Redirecionar após salvar os dados
            });
        })
        .catch((error) => {
            if (error.code === "auth/email-already-in-use") {
                // Se o e-mail já estiver em uso, tentar realizar login
                auth.signInWithEmailAndPassword(email, password)
                    .then((userCredential) => {
                        const user = userCredential.user;

                        // Atualizar dados no Firestore
                        return db.collection("usuarios").doc(user.uid).set({
                            ultimoLogin: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }).then(() => {
                            
                            
                            window.location.href = "forms.html"; // Redirecionar após atualizar os dados
                        });
                    })
                    .catch((loginError) => {
                       
                        
                        resetButton();
                    });
            } else {
                
                
                resetButton();
            }
        });
}

// Função para resetar o botão após erro
function resetButton() {
    const button = document.querySelector('button[type="submit"]');
    button.innerHTML = "Entrar";
    button.disabled = false;
}

// Validar formulário antes de submeter
document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("senha").value;
    const nome = document.getElementById("nome").value;
    const numero = document.getElementById("numero").value;

    // Validações
    if (!nome) {
        showError(document.getElementById("nome"), "Nome é obrigatório");
        return;
    }

    if (!numero) {
        showError(document.getElementById("numero"), "Número é obrigatório");
        return;
    }

    if (password.length < 6) {
        const senha = document.getElementById("senha");
        senha.style.animation = "shake 0.5s ease-in-out";
        showError(senha, "A senha deve ter pelo menos 6 caracteres");
        setTimeout(() => {
            senha.style.animation = "";
        }, 500);
        return;
    }

    // Adicionar animação de carregamento no botão
    const button = this.querySelector("button");
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processando...';
    button.disabled = true;

    // Tentar cadastrar/login
    loginUser(email, password);
});

// Função para exibir erros nos inputs
function showError(input, message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message animate__animated animate__shakeX";
    errorDiv.textContent = message;
    input.parentElement.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}
