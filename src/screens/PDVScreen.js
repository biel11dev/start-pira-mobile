import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Appbar,
  Card,
  TextInput,
  Button,
  Chip,
  Text,
  Divider,
  IconButton,
  Portal,
  Modal,
  ActivityIndicator,
  RadioButton,
  Checkbox,
} from 'react-native-paper';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatarValor } from '../utils/format';

// Formas de pagamento padrão (usadas se a API não retornar nenhuma)
const FORMAS_PADRAO = [
  { id: 'f-din', nome: 'Dinheiro', valor: 'dinheiro' },
  { id: 'f-cart', nome: 'Cartão', valor: 'cartao' },
  { id: 'f-pix', nome: 'Pix', valor: 'pix_online', pointType: 'pix_online' },
  { id: 'f-vale', nome: 'Vale', valor: 'vale' },
  { id: 'f-fiado', nome: 'Fiado', valor: 'pendente' },
];

// Seletor de origens reutilizável (ADD / Vale / Prêmio).
// Cada linha: nome da origem (Picker) + valor. Permite adicionar/remover linhas.
function OrigemRows({ origens, setOrigens, origensDisponiveis }) {
  const add = () => setOrigens([...origens, { nome: '', valor: '' }]);
  const remove = (i) => {
    if (origens.length <= 1) return;
    setOrigens(origens.filter((_, idx) => idx !== i));
  };
  const change = (i, field, val) => {
    const u = origens.map((o, idx) => (idx === i ? { ...o, [field]: val } : o));
    setOrigens(u);
  };
  return (
    <View>
      {origens.map((o, i) => (
        <View key={i} style={styles.origemRow}>
          <View style={styles.origemPickerWrap}>
            <Picker
              selectedValue={o.nome}
              onValueChange={(v) => change(i, 'nome', v)}
              dropdownIconColor="#fff"
              style={styles.origemPicker}
            >
              <Picker.Item label="Origem..." value="" color="#999" />
              {(origensDisponiveis || []).map((od) => (
                <Picker.Item key={od.id || od.nome} label={od.nome} value={od.nome} />
              ))}
            </Picker>
          </View>
          <TextInput
            mode="outlined"
            dense
            keyboardType="numeric"
            placeholder="0,00"
            value={o.valor}
            onChangeText={(v) => change(i, 'valor', v)}
            style={styles.origemValorInput}
          />
          {origens.length > 1 && (
            <IconButton icon="close" size={18} iconColor="#ff6b6b" onPress={() => remove(i)} />
          )}
        </View>
      ))}
      <Button mode="text" icon="plus" onPress={add} textColor="#2196F3" compact>
        Adicionar origem
      </Button>
    </View>
  );
}


export default function PDVScreen({ navigation }) {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [selectedProductUnits, setSelectedProductUnits] = useState({});
  const [carrinho, setCarrinho] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);

  const [formasPagamento, setFormasPagamento] = useState(FORMAS_PADRAO);
  const [clientes, setClientes] = useState([]);

  // Modal de checkout
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [formaSelecionada, setFormaSelecionada] = useState(null);
  const [valorRecebido, setValorRecebido] = useState('');
  const [senhaVale, setSenhaVale] = useState('');
  const [clienteFiadoId, setClienteFiadoId] = useState(null);
  const [clienteBusca, setClienteBusca] = useState('');
  const [descontoTipo, setDescontoTipo] = useState('VALOR'); // VALOR | PERCENTUAL
  const [descontoValor, setDescontoValor] = useState('');

  // Modal Pix
  const [pixVisible, setPixVisible] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [pixStatus, setPixStatus] = useState('waiting');
  const pixPollRef = useRef(null);
  const pixOrderIdRef = useRef(null);

  // Sub-módulos (abas): venda | comandas | saque
  const isAdmin = user?.permissions?.acessos === true;
  const [subTab, setSubTab] = useState('venda');

  // Máquina (Mercado Pago Point)
  const [pointVisible, setPointVisible] = useState(false);
  const [pointOrder, setPointOrder] = useState(null);
  const [pointStatus, setPointStatus] = useState('waiting');
  const pointPollRef = useRef(null);
  const pointOrderIdRef = useRef(null);

  // Comanda em pagamento (fluxo de fechamento de comanda)
  const [comandas, setComandas] = useState([]);
  const [loadingComandas, setLoadingComandas] = useState(false);
  const [comandaEmPagamento, setComandaEmPagamento] = useState(null);

  // Saque (troco via máquina)
  const [saqueValor, setSaqueValor] = useState('');
  const [saqueObs, setSaqueObs] = useState('');
  const [saqueFormaId, setSaqueFormaId] = useState(null);
  const [taxaSaque, setTaxaSaque] = useState(30);
  const [savingSaque, setSavingSaque] = useState(false);

  // Origens (compartilhado por ADD / Vale / Prêmio / Config)
  const [origensDisponiveis, setOrigensDisponiveis] = useState([]);
  const [origemSaldos, setOrigemSaldos] = useState([]);

  // ADD (adicionar dinheiro ao caixa)
  const [addValorTotal, setAddValorTotal] = useState('');
  const [addOrigens, setAddOrigens] = useState([{ nome: '', valor: '' }]);
  const [addObs, setAddObs] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);

  // Vale (retirada do caixa)
  const [valeValorTotal, setValeValorTotal] = useState('');
  const [valeOrigens, setValeOrigens] = useState([{ nome: '', valor: '' }]);
  const [valeObs, setValeObs] = useState('');
  const [savingVale, setSavingVale] = useState(false);

  // Prêmio (registro de prêmio com comprovantes)
  const [premioStep, setPremioStep] = useState(1);
  const [premioImagem1, setPremioImagem1] = useState(null);
  const [premioImagem2, setPremioImagem2] = useState(null);
  const [premioValor, setPremioValor] = useState('');
  const [premioOrigens, setPremioOrigens] = useState([{ nome: '', valor: '' }]);
  const [premioObs, setPremioObs] = useState('');
  const [savingPremio, setSavingPremio] = useState(false);

  // Composição (produtos dose / com componentes)
  const [compModalProduct, setCompModalProduct] = useState(null);
  const [compSelections, setCompSelections] = useState({}); // { composicaoId: [opcaoId, ...] }

  // Cadastro rápido de cliente (fiado/comanda)
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [savingCliente, setSavingCliente] = useState(false);

  // Venda conjunta (Compra + Saque na mesma venda)
  const [saqueVendaValor, setSaqueVendaValor] = useState('');

  // Config. Venda
  const [configTab, setConfigTab] = useState('cupons'); // cupons | taxas | limites | formas | saque | origens
  const [cupons, setCupons] = useState([]);
  const [novoCupom, setNovoCupom] = useState({ codigo: '', tipo: 'PERCENTUAL', valor: '', validoAte: '', limiteUso: '' });
  const [taxas, setTaxas] = useState([]);
  const [novaTaxa, setNovaTaxa] = useState({ nome: '', tipo: 'PERCENTUAL', valor: '' });
  const [configLimites, setConfigLimites] = useState([]);
  const [limiteEdits, setLimiteEdits] = useState({});
  const [formasConfig, setFormasConfig] = useState([]);
  const [pointConfig, setPointConfig] = useState(null);
  const [pointTerminals, setPointTerminals] = useState([]);
  const [loadingPointTerminals, setLoadingPointTerminals] = useState(false);
  const [savingPointConfig, setSavingPointConfig] = useState(false);
  const [novaFormaNome, setNovaFormaNome] = useState('');
  const [taxaSaqueInput, setTaxaSaqueInput] = useState('');
  const [savingTaxaSaque, setSavingTaxaSaque] = useState(false);
  const [novaOrigemNome, setNovaOrigemNome] = useState('');
  // Origem: movimentação manual
  const [origemMovNome, setOrigemMovNome] = useState('');
  const [origemMovTipo, setOrigemMovTipo] = useState('ENTRADA');
  const [origemMovValor, setOrigemMovValor] = useState('');
  const [origemMovDesc, setOrigemMovDesc] = useState('');
  // Origem: transferência
  const [transfFrom, setTransfFrom] = useState('');
  const [transfTo, setTransfTo] = useState('');
  const [transfValor, setTransfValor] = useState('');
  const [transfDesc, setTransfDesc] = useState('');

  // Caixa (sub-caixa diário do PDV)
  const [caixaSubTab, setCaixaSubTab] = useState('atual'); // atual | historico | gastosbar | origens
  const [caixaAtual, setCaixaAtual] = useState(null);
  const [caixaHistorico, setCaixaHistorico] = useState([]);
  const [loadingCaixa, setLoadingCaixa] = useState(false);
  const [abrirCaixaVisible, setAbrirCaixaVisible] = useState(false);
  const [fecharCaixaVisible, setFecharCaixaVisible] = useState(false);
  const [caixaSaldoInicial, setCaixaSaldoInicial] = useState('');
  const [caixaObsAbrir, setCaixaObsAbrir] = useState('');
  const [caixaOrigemBAG, setCaixaOrigemBAG] = useState('');
  const [caixaOrigemMAQUINA, setCaixaOrigemMAQUINA] = useState('');
  const [caixaObsFechar, setCaixaObsFechar] = useState('');
  const [savingCaixa, setSavingCaixa] = useState(false);
  // Gastos Bar
  const [gastosBarSemanas, setGastosBarSemanas] = useState([]);
  const [gastosBarResumo, setGastosBarResumo] = useState([]);
  const [gastosBarView, setGastosBarView] = useState('semanas'); // semanas | funcionarios
  const [loadingGastosBar, setLoadingGastosBar] = useState(false);
  // Origem histórico (visão dentro do Caixa)
  const [origemHistoricoNome, setOrigemHistoricoNome] = useState(null);
  const [origemHistoricoMovs, setOrigemHistoricoMovs] = useState([]);
  const [loadingOrigemHistorico, setLoadingOrigemHistorico] = useState(false);

  // Pedidos
  const [pedidosTab, setPedidosTab] = useState('historico'); // historico | online
  const [ultimosPedidos, setUltimosPedidos] = useState([]);
  const [pedidosDataInicio, setPedidosDataInicio] = useState('');
  const [pedidosDataFim, setPedidosDataFim] = useState('');
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidosOnline, setPedidosOnline] = useState([]);
  const [onlineStatusFiltro, setOnlineStatusFiltro] = useState('');
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [atualizandoStatusId, setAtualizandoStatusId] = useState(null);

  useEffect(() => {
    carregarProdutos();
    carregarFormasPagamento();
    carregarTaxaSaque();
    return () => {
      if (pixPollRef.current) clearInterval(pixPollRef.current);
      if (pointPollRef.current) clearInterval(pointPollRef.current);
    };
  }, []);

  const carregarProdutos = async () => {
    try {
      const response = await api.get('/api/estoque_prod');
      // Uma linha por produto+unidade. Excluir componentes de composição
      // e unidades ocultas no PDV para o produto.
      const lista = (response.data || []).filter(
        (p) =>
          !(p._count?.composicaoOpcoes > 0) &&
          !((p.product?.pdvHiddenUnits || []).includes(p.unit))
      );
      setProdutos(lista);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os produtos');
    }
  };

  const carregarFormasPagamento = async () => {
    try {
      const res = await api.get('/api/pdv-formas-pagamento');
      const ativas = (res.data || []).filter((f) => f.ativo !== false);
      if (ativas.length > 0) setFormasPagamento(ativas);
    } catch (error) {
      // Mantém as formas padrão
      console.log('Usando formas de pagamento padrão');
    }
  };

  const carregarClientes = async () => {
    try {
      const res = await api.get('/api/clients');
      setClientes(res.data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const carregarTaxaSaque = async () => {
    try {
      const res = await api.get('/api/pdv-saque/config');
      if (res.data?.taxa != null) setTaxaSaque(parseFloat(res.data.taxa));
    } catch (error) {
      console.log('Usando taxa de saque padrão (30%)');
    }
  };

  const carregarComandas = async () => {
    setLoadingComandas(true);
    try {
      const res = await api.get('/api/pdv-comandas-pendentes');
      setComandas(res.data || []);
    } catch (error) {
      console.error('Erro ao carregar comandas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as comandas');
    } finally {
      setLoadingComandas(false);
    }
  };

  // ---- Origens (compartilhado) ----
  const carregarOrigens = async () => {
    try {
      const res = await api.get('/api/pdv-origens');
      setOrigensDisponiveis(res.data || []);
    } catch (error) {
      console.log('Erro ao carregar origens');
    }
  };

  const carregarOrigemSaldos = async () => {
    try {
      let res = await api.get('/api/pdv-origem-saldo');
      if ((res.data || []).length === 0) {
        await api.post('/api/pdv-origem-saldo/init');
        res = await api.get('/api/pdv-origem-saldo');
      }
      setOrigemSaldos(res.data || []);
    } catch (error) {
      console.log('Erro ao carregar saldos de origem');
    }
  };

  const somaOrigens = (arr) =>
    (arr || []).reduce((s, o) => s + (parseFloat(o.valor) || 0), 0);

  // ---- ADD (adicionar dinheiro ao caixa) ----
  const confirmarAdd = async () => {
    const valorTotal = parseFloat(addValorTotal);
    if (!valorTotal || valorTotal <= 0) {
      Alert.alert('Atenção', 'Informe o valor total');
      return;
    }
    const preenchidas = addOrigens.filter((o) => o.nome && parseFloat(o.valor) > 0);
    if (preenchidas.length === 0) {
      Alert.alert('Atenção', 'Informe pelo menos uma origem');
      return;
    }
    if (Math.abs(somaOrigens(preenchidas) - valorTotal) > 0.01) {
      Alert.alert(
        'Atenção',
        `A soma das origens (R$ ${formatarValor(somaOrigens(preenchidas))}) deve ser igual ao total (R$ ${formatarValor(valorTotal)})`
      );
      return;
    }
    setSavingAdd(true);
    try {
      await api.post('/api/pdv-caixa-movimento', {
        tipo: 'ADD',
        valor: valorTotal,
        origens: preenchidas.map((o) => ({ nome: o.nome, valor: parseFloat(o.valor) })),
        observacao: addObs || null,
      });
      Alert.alert('Sucesso', 'Valor adicionado ao caixa!');
      setAddValorTotal('');
      setAddOrigens([{ nome: '', valor: '' }]);
      setAddObs('');
      carregarOrigemSaldos();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao adicionar valor');
    } finally {
      setSavingAdd(false);
    }
  };

  // ---- Vale (retirada do caixa) ----
  const confirmarVale = async () => {
    const valorTotal = parseFloat(valeValorTotal);
    if (!valorTotal || valorTotal <= 0) {
      Alert.alert('Atenção', 'Informe o valor do vale');
      return;
    }
    const preenchidas = valeOrigens.filter((o) => o.nome && parseFloat(o.valor) > 0);
    if (preenchidas.length > 0 && Math.abs(somaOrigens(preenchidas) - valorTotal) > 0.01) {
      Alert.alert(
        'Atenção',
        `A soma dos destinos (R$ ${formatarValor(somaOrigens(preenchidas))}) deve ser igual ao valor total (R$ ${formatarValor(valorTotal)})`
      );
      return;
    }
    setSavingVale(true);
    try {
      const res = await api.post('/api/pdv-caixa-vale', {
        valor: valorTotal,
        origens: preenchidas.map((o) => ({ nome: o.nome, valor: parseFloat(o.valor) })),
        observacao: valeObs || null,
      });
      let msg = 'Vale registrado!';
      if (res.data?.isAdmin && res.data?.despesaPessoal) msg += ' Despesa criada no módulo Pessoal.';
      if (res.data?.isFuncionario && res.data?.gastoBar) msg += ' Lançado em Gastos Bar (descontado no Ponto).';
      Alert.alert('Sucesso', msg);
      setValeValorTotal('');
      setValeOrigens([{ nome: '', valor: '' }]);
      setValeObs('');
      carregarOrigemSaldos();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao registrar vale');
    } finally {
      setSavingVale(false);
    }
  };

  // ---- Prêmio ----
  const escolherImagemPremio = async (setImage, source = 'galeria') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão', 'Permita o acesso à câmera para tirar a foto.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.6,
          base64: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset?.base64) {
          Alert.alert('Erro', 'Não foi possível ler a imagem');
          return;
        }
        setImage(`data:image/jpeg;base64,${asset.base64}`);
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão', 'Permita o acesso às fotos para anexar o comprovante.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        Alert.alert('Erro', 'Não foi possível ler a imagem');
        return;
      }
      setImage(`data:image/jpeg;base64,${asset.base64}`);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao selecionar imagem');
    }
  };

  // Pergunta a origem da imagem (câmera ou galeria) antes de anexar
  const anexarImagemPremio = (setImage) => {
    Alert.alert('Comprovante', 'Escolha a origem da imagem', [
      { text: 'Câmera', onPress: () => escolherImagemPremio(setImage, 'camera') },
      { text: 'Galeria', onPress: () => escolherImagemPremio(setImage, 'galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const premioAvancar = (toStep) => {
    if (toStep === 2 && !premioImagem1) {
      Alert.alert('Atenção', 'Anexe a imagem de comprovação do ganho');
      return;
    }
    if (toStep === 3) {
      if (!premioImagem2) {
        Alert.alert('Atenção', 'Anexe a imagem de comprovação da baixa');
        return;
      }
      const v = parseFloat(premioValor);
      if (!v || v <= 0) {
        Alert.alert('Atenção', 'Informe o valor do prêmio');
        return;
      }
      const preenchidas = premioOrigens.filter((o) => o.nome && parseFloat(o.valor) > 0);
      if (preenchidas.length > 0 && Math.abs(somaOrigens(preenchidas) - v) > 0.01) {
        Alert.alert('Atenção', 'A soma das origens deve ser igual ao valor do prêmio');
        return;
      }
    }
    setPremioStep(toStep);
  };

  const confirmarPremio = async () => {
    setSavingPremio(true);
    try {
      const preenchidas = premioOrigens.filter((o) => o.nome && parseFloat(o.valor) > 0);
      await api.post('/api/pdv-premio', {
        imagem1: premioImagem1,
        imagem2: premioImagem2,
        valor: parseFloat(premioValor),
        origens: preenchidas.map((o) => ({ nome: o.nome, valor: parseFloat(o.valor) })),
        observacao: premioObs || null,
      });
      Alert.alert('Sucesso', 'Prêmio registrado!');
      setPremioStep(1);
      setPremioImagem1(null);
      setPremioImagem2(null);
      setPremioValor('');
      setPremioOrigens([{ nome: '', valor: '' }]);
      setPremioObs('');
      carregarOrigemSaldos();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao registrar prêmio');
    } finally {
      setSavingPremio(false);
    }
  };

  // ---- Config. Venda ----
  const carregarCupons = async () => {
    try {
      const r = await api.get('/api/pdv-cupons');
      setCupons(r.data || []);
    } catch (e) { /* silencioso */ }
  };
  const carregarTaxas = async () => {
    try {
      const r = await api.get('/api/pdv-taxas');
      setTaxas(r.data || []);
    } catch (e) { /* silencioso */ }
  };
  const carregarConfigLimites = async () => {
    try {
      let r = await api.get('/api/pdv-config');
      if ((r.data || []).length === 0) {
        await api.post('/api/pdv-config/init');
        r = await api.get('/api/pdv-config');
      }
      setConfigLimites(r.data || []);
    } catch (e) { /* silencioso */ }
  };
  const carregarFormasConfig = async () => {
    try {
      const r = await api.get('/api/pdv-formas-pagamento');
      setFormasConfig(r.data || []);
    } catch (e) { /* silencioso */ }
    try {
      const c = await api.get('/api/point/config');
      setPointConfig(c.data || null);
    } catch (e) { setPointConfig(null); }
  };

  const togglePointForma = async (id, campo, valor) => {
    try {
      await api.put(`/api/pdv-formas-pagamento/${id}`, { [campo]: valor });
      carregarFormasConfig();
      carregarFormasPagamento();
    } catch (e) {
      Alert.alert('Erro', 'Erro ao atualizar integração da maquininha');
    }
  };

  // ---- Maquininha (Mercado Pago Point): busca/seleção de terminal ----
  const buscarMaquininhas = async () => {
    setLoadingPointTerminals(true);
    try {
      const res = await api.get('/api/point/terminals');
      setPointTerminals(res.data?.terminals || []);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao listar maquininhas');
    } finally {
      setLoadingPointTerminals(false);
    }
  };

  const salvarPointConfig = async (patch) => {
    setSavingPointConfig(true);
    try {
      const res = await api.put('/api/point/config', patch);
      setPointConfig(res.data || null);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao salvar configuração da maquininha');
    } finally {
      setSavingPointConfig(false);
    }
  };

  const setPointTerminalMode = async (terminalId, mode) => {
    try {
      await api.post('/api/point/terminals/mode', { terminalId, mode });
      Alert.alert('Sucesso', `Modo do terminal alterado para ${mode}.`);
      buscarMaquininhas();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao alterar modo do terminal');
    }
  };

  const criarCupom = async () => {
    if (!novoCupom.codigo || !novoCupom.valor) {
      Alert.alert('Atenção', 'Código e valor são obrigatórios');
      return;
    }
    try {
      await api.post('/api/pdv-cupons', {
        ...novoCupom,
        valor: parseFloat(novoCupom.valor),
        limiteUso: novoCupom.limiteUso ? parseInt(novoCupom.limiteUso, 10) : null,
        validoAte: novoCupom.validoAte || null,
      });
      setNovoCupom({ codigo: '', tipo: 'PERCENTUAL', valor: '', validoAte: '', limiteUso: '' });
      carregarCupons();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao criar cupom');
    }
  };
  const toggleCupom = async (id, ativo) => {
    try { await api.put(`/api/pdv-cupons/${id}`, { ativo: !ativo }); carregarCupons(); } catch (e) {}
  };
  const excluirCupom = async (id) => {
    try { await api.delete(`/api/pdv-cupons/${id}`); carregarCupons(); } catch (e) {}
  };

  const criarTaxa = async () => {
    if (!novaTaxa.nome || !novaTaxa.valor) {
      Alert.alert('Atenção', 'Nome e valor são obrigatórios');
      return;
    }
    try {
      await api.post('/api/pdv-taxas', { ...novaTaxa, valor: parseFloat(novaTaxa.valor) });
      setNovaTaxa({ nome: '', tipo: 'PERCENTUAL', valor: '' });
      carregarTaxas();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao criar taxa');
    }
  };
  const toggleTaxa = async (id, ativo) => {
    try { await api.put(`/api/pdv-taxas/${id}`, { ativo: !ativo }); carregarTaxas(); } catch (e) {}
  };
  const excluirTaxa = async (id) => {
    try { await api.delete(`/api/pdv-taxas/${id}`); carregarTaxas(); } catch (e) {}
  };

  const salvarLimite = async (chave, valor, descricao) => {
    try {
      await api.put(`/api/pdv-config/${chave}`, { valor, descricao });
      carregarConfigLimites();
      Alert.alert('Sucesso', 'Configuração salva');
    } catch (e) {
      Alert.alert('Erro', 'Erro ao salvar configuração');
    }
  };

  const criarFormaConfig = async () => {
    if (!novaFormaNome.trim()) return;
    try {
      await api.post('/api/pdv-formas-pagamento', { nome: novaFormaNome.trim() });
      setNovaFormaNome('');
      carregarFormasConfig();
      carregarFormasPagamento();
    } catch (e) {
      Alert.alert('Erro', 'Erro ao criar forma de pagamento');
    }
  };
  const toggleFormaConfig = async (id, ativo) => {
    try {
      await api.put(`/api/pdv-formas-pagamento/${id}`, { ativo: !ativo });
      carregarFormasConfig();
      carregarFormasPagamento();
    } catch (e) {}
  };
  const excluirFormaConfig = async (id) => {
    try {
      await api.delete(`/api/pdv-formas-pagamento/${id}`);
      carregarFormasConfig();
      carregarFormasPagamento();
    } catch (e) {}
  };

  const salvarTaxaSaque = async () => {
    const taxa = parseFloat(taxaSaqueInput);
    if (isNaN(taxa) || taxa < 0 || taxa > 100) {
      Alert.alert('Atenção', 'Taxa inválida. Informe um valor entre 0 e 100.');
      return;
    }
    setSavingTaxaSaque(true);
    try {
      const r = await api.put('/api/pdv-saque/config', { taxa });
      setTaxaSaque(r.data?.taxa ?? taxa);
      setTaxaSaqueInput('');
      Alert.alert('Sucesso', `Taxa atualizada para ${r.data?.taxa ?? taxa}%`);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao salvar taxa');
    } finally {
      setSavingTaxaSaque(false);
    }
  };

  const criarOrigem = async () => {
    if (!novaOrigemNome.trim()) return;
    try {
      await api.post('/api/pdv-origens', { nome: novaOrigemNome.trim() });
      setNovaOrigemNome('');
      carregarOrigens();
      carregarOrigemSaldos();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao criar origem');
    }
  };
  const excluirOrigem = async (id) => {
    try {
      await api.delete(`/api/pdv-origens/${id}`);
      carregarOrigens();
      carregarOrigemSaldos();
    } catch (e) {
      Alert.alert('Erro', 'Erro ao excluir origem');
    }
  };

  const origemMovimentar = async () => {
    if (!origemMovNome) {
      Alert.alert('Atenção', 'Selecione a origem');
      return;
    }
    const v = parseFloat(origemMovValor);
    if (!v || v <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido');
      return;
    }
    try {
      await api.post(`/api/pdv-origem-saldo/${encodeURIComponent(origemMovNome)}/movimentar`, {
        tipo: origemMovTipo,
        valor: v,
        descricao: origemMovDesc,
      });
      await carregarOrigemSaldos();
      setOrigemMovValor('');
      setOrigemMovDesc('');
      Alert.alert('Sucesso', 'Movimentação registrada');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao movimentar origem');
    }
  };

  const origemTransferir = async () => {
    if (!transfFrom || !transfTo) {
      Alert.alert('Atenção', 'Selecione origem e destino');
      return;
    }
    if (transfFrom === transfTo) {
      Alert.alert('Atenção', 'Origem e destino devem ser diferentes');
      return;
    }
    const v = parseFloat(transfValor);
    if (!v || v <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido');
      return;
    }
    try {
      await api.post('/api/pdv-origem-saldo/transferir', {
        origem: transfFrom,
        destino: transfTo,
        valor: v,
        descricao: transfDesc,
      });
      await carregarOrigemSaldos();
      setTransfValor('');
      setTransfDesc('');
      Alert.alert('Sucesso', 'Transferência realizada');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao transferir');
    }
  };

  // ---- Caixa (sub-caixa diário) ----
  const carregarCaixaAtual = async () => {
    try {
      const res = await api.get('/api/pdv-caixa-controle/atual');
      setCaixaAtual(res.data || null);
    } catch (error) {
      console.log('Erro ao buscar caixa atual');
    }
  };

  const carregarCaixaHistorico = async () => {
    try {
      const res = await api.get('/api/pdv-caixa-controle/historico');
      setCaixaHistorico(res.data?.caixas || []);
    } catch (error) {
      console.log('Erro ao buscar histórico de caixa');
    }
  };

  const abrirCaixa = async () => {
    setSavingCaixa(true);
    try {
      await api.post('/api/pdv-caixa-controle/abrir', {
        saldoInicial: parseFloat(caixaSaldoInicial) || 0,
        observacao: caixaObsAbrir || null,
        origemBAG: caixaOrigemBAG !== '' ? parseFloat(caixaOrigemBAG) : null,
        origemMAQUINA: caixaOrigemMAQUINA !== '' ? parseFloat(caixaOrigemMAQUINA) : null,
      });
      setAbrirCaixaVisible(false);
      setCaixaSaldoInicial('');
      setCaixaObsAbrir('');
      setCaixaOrigemBAG('');
      setCaixaOrigemMAQUINA('');
      await carregarCaixaAtual();
      await carregarOrigemSaldos();
      Alert.alert('Sucesso', 'Caixa aberto com sucesso!');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao abrir caixa');
    } finally {
      setSavingCaixa(false);
    }
  };

  const fecharCaixa = async () => {
    setSavingCaixa(true);
    try {
      await api.put('/api/pdv-caixa-controle/fechar', {
        observacao: caixaObsFechar || null,
      });
      setFecharCaixaVisible(false);
      setCaixaObsFechar('');
      await carregarCaixaAtual();
      Alert.alert('Sucesso', 'Caixa fechado e migrado para o registro mensal!');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao fechar caixa');
    } finally {
      setSavingCaixa(false);
    }
  };

  const carregarGastosBar = async () => {
    setLoadingGastosBar(true);
    try {
      const [semanas, resumo] = await Promise.all([
        api.get('/api/pdv-gastos-bar'),
        api.get('/api/pdv-gastos-bar/resumo'),
      ]);
      setGastosBarSemanas(semanas.data || []);
      setGastosBarResumo(resumo.data || []);
    } catch (error) {
      console.log('Erro ao buscar gastos bar');
    } finally {
      setLoadingGastosBar(false);
    }
  };

  const carregarOrigemHistorico = async (nome) => {
    if (origemHistoricoNome === nome) {
      setOrigemHistoricoNome(null);
      setOrigemHistoricoMovs([]);
      return;
    }
    setLoadingOrigemHistorico(true);
    setOrigemHistoricoNome(nome);
    setOrigemHistoricoMovs([]);
    try {
      const res = await api.get(
        `/api/pdv-origem-saldo/${encodeURIComponent(nome)}/historico?limit=30`
      );
      setOrigemHistoricoMovs(res.data?.movimentos || []);
    } catch (error) {
      console.log('Erro ao buscar histórico da origem');
    } finally {
      setLoadingOrigemHistorico(false);
    }
  };

  const abrirCaixaTab = () => {
    setSubTab('caixa');
    setCaixaSubTab('atual');
    carregarCaixaAtual();
  };

  // ---- Pedidos ----
  const PEDIDO_STATUS = ['pending', 'preparing', 'ready', 'delivered'];
  const PEDIDO_STATUS_LABELS = {
    pending: 'Pendente',
    preparing: 'Em preparo',
    ready: 'Pronto para retirada',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
  };
  const proximoStatus = (status) => {
    const idx = PEDIDO_STATUS.indexOf(status);
    if (idx === -1 || idx >= PEDIDO_STATUS.length - 1) return null;
    return PEDIDO_STATUS[idx + 1];
  };

  const carregarUltimosPedidos = async () => {
    setLoadingPedidos(true);
    try {
      const params = {};
      if (pedidosDataInicio) params.dataInicio = pedidosDataInicio;
      if (pedidosDataFim) params.dataFim = pedidosDataFim;
      const r = await api.get('/api/sales', { params });
      setUltimosPedidos(r.data || []);
    } catch (e) {
      Alert.alert('Erro', 'Erro ao carregar pedidos');
    } finally {
      setLoadingPedidos(false);
    }
  };

  const carregarPedidosOnline = async (statusArg) => {
    const status = statusArg !== undefined ? statusArg : onlineStatusFiltro;
    setLoadingOnline(true);
    try {
      const params = {};
      if (status) params.status = status;
      const r = await api.get('/api/sales/online', { params });
      setPedidosOnline(r.data || []);
    } catch (e) {
      Alert.alert('Erro', 'Erro ao carregar pedidos online');
    } finally {
      setLoadingOnline(false);
    }
  };

  const atualizarStatusOnline = async (pedidoId, novoStatus) => {
    setAtualizandoStatusId(pedidoId);
    try {
      const r = await api.put(`/api/sales/${pedidoId}/status`, { status: novoStatus });
      setPedidosOnline((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, statusPedido: novoStatus } : p))
      );
      const wpp = r.data?.whatsapp;
      if (wpp?.link) {
        Linking.openURL(wpp.link).catch(() => {});
      } else if (wpp && wpp.hasPhone === false) {
        Alert.alert('Status atualizado', `"${PEDIDO_STATUS_LABELS[novoStatus]}". Cliente sem telefone para WhatsApp.`);
      }
      if (onlineStatusFiltro && onlineStatusFiltro !== novoStatus) carregarPedidosOnline();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao atualizar status');
    } finally {
      setAtualizandoStatusId(null);
    }
  };

  const adicionarAoCarrinho = (produto) => {
    // Produto com composição (dose / componentes): abre modal de seleção
    if (produto.composicoes && produto.composicoes.length > 0) {
      setCompSelections({});
      setCompModalProduct(produto);
      return;
    }
    const key = `simple-${produto.id}`;
    const itemExistente = carrinho.find((item) => item.compostoKey === key);
    if (itemExistente) {
      setCarrinho(
        carrinho.map((item) =>
          item.compostoKey === key
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        )
      );
    } else {
      setCarrinho([
        ...carrinho,
        {
          id: produto.id,
          name: produto.name,
          value: produto.value,
          unit: produto.unit,
          maxQuantity: produto.quantity,
          quantidade: 1,
          compostoKey: key,
        },
      ]);
    }
  };

  // Incrementa a quantidade de um item já no carrinho (respeita compostoKey)
  const incrementarCarrinho = (item) => {
    setCarrinho(
      carrinho.map((i) =>
        i.compostoKey === item.compostoKey ? { ...i, quantidade: i.quantidade + 1 } : i
      )
    );
  };

  const removerDoCarrinho = (item) => {
    const alvo = carrinho.find((i) => i.compostoKey === item.compostoKey);
    if (!alvo) return;
    if (alvo.quantidade > 1) {
      setCarrinho(
        carrinho.map((i) =>
          i.compostoKey === item.compostoKey ? { ...i, quantidade: i.quantidade - 1 } : i
        )
      );
    } else {
      setCarrinho(carrinho.filter((i) => i.compostoKey !== item.compostoKey));
    }
  };

  // Alterna uma opção dentro de uma composição
  const toggleCompOpcao = (composicaoId, opcaoId, multiplo, maxOpcoes) => {
    setCompSelections((prev) => {
      const current = prev[composicaoId] || [];
      if (current.includes(opcaoId)) {
        return { ...prev, [composicaoId]: current.filter((id) => id !== opcaoId) };
      }
      if (!multiplo) return { ...prev, [composicaoId]: [opcaoId] };
      if (current.length >= maxOpcoes)
        return { ...prev, [composicaoId]: [...current.slice(1), opcaoId] };
      return { ...prev, [composicaoId]: [...current, opcaoId] };
    });
  };

  // Confirma a composição e adiciona o item montado ao carrinho
  const confirmComposicao = () => {
    if (!compModalProduct) return;
    if (compModalProduct.quantity < 1) {
      Alert.alert('Estoque', `Estoque insuficiente para "${compModalProduct.name}".`);
      return;
    }
    const comps = compModalProduct.composicoes || [];
    for (const comp of comps) {
      if (comp.obrigatorio && !(compSelections[comp.id] || []).length) {
        Alert.alert('Atenção', `Selecione uma opção para "${comp.nome}".`);
        return;
      }
    }
    let extraTotal = 0;
    const labelParts = [];
    comps.forEach((comp) => {
      const sel = compSelections[comp.id] || [];
      const selectedOpcoes = (comp.opcoes || []).filter((o) => sel.includes(o.id));
      selectedOpcoes.forEach((o) => {
        extraTotal += o.valorExtra || 0;
      });
      if (selectedOpcoes.length > 0)
        labelParts.push(`${comp.nome}: ${selectedOpcoes.map((o) => o.nome).join(', ')}`);
    });
    const finalPrice = compModalProduct.value + extraTotal;
    const composicaoLabel = labelParts.join(' | ');
    const composicaoJSON = JSON.stringify(compSelections);
    const key = `${compModalProduct.id}__${composicaoJSON}`;
    const existente = carrinho.find((i) => i.compostoKey === key);
    if (existente) {
      setCarrinho(
        carrinho.map((i) =>
          i.compostoKey === key ? { ...i, quantidade: i.quantidade + 1 } : i
        )
      );
    } else {
      setCarrinho([
        ...carrinho,
        {
          id: compModalProduct.id,
          name: compModalProduct.name,
          value: finalPrice,
          unit: compModalProduct.unit,
          maxQuantity: compModalProduct.quantity,
          quantidade: 1,
          compostoKey: key,
          composicao: composicaoJSON,
          composicaoLabel,
        },
      ]);
    }
    setCompModalProduct(null);
    setCompSelections({});
  };

  // Cadastro rápido de cliente durante o fluxo de fiado/comanda
  const cadastrarClienteInline = async () => {
    const nome = novoClienteNome.trim();
    if (!nome) {
      Alert.alert('Atenção', 'Informe o nome do cliente');
      return;
    }
    setSavingCliente(true);
    try {
      const res = await api.post('/api/clients', { name: nome, totalDebt: 0 });
      const novo = res.data;
      await carregarClientes();
      if (novo?.id) setClienteFiadoId(novo.id);
      setNovoClienteNome('');
      Alert.alert('Sucesso', 'Cliente cadastrado!');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao cadastrar cliente');
    } finally {
      setSavingCliente(false);
    }
  };

  const calcularSubtotal = () =>
    carrinho.reduce((total, item) => total + item.value * item.quantidade, 0);

  const calcularDesconto = (subtotal) => {
    const v = parseFloat(descontoValor) || 0;
    if (v <= 0) return 0;
    if (descontoTipo === 'PERCENTUAL') {
      return Math.min((subtotal * v) / 100, subtotal);
    }
    return Math.min(v, subtotal);
  };

  const calcularTotalFinal = () => {
    const subtotal = calcularSubtotal();
    return subtotal - calcularDesconto(subtotal);
  };

  // Identifica o comportamento da forma de pagamento
  const tipoForma = (forma) => {
    if (!forma) return 'outros';
    if (forma.pointType === 'pix_online') return 'pix';
    // Maquininha (Mercado Pago Point): crédito, débito ou "cliente escolhe"
    if (forma.pointEnabled) return 'point';
    if (forma.valor === 'dinheiro') return 'dinheiro';
    if (forma.valor === 'vale') return 'vale';
    if (forma.valor === 'pendente') return 'fiado';
    return 'outros';
  };

  const abrirCheckout = () => {
    if (carrinho.length === 0) {
      Alert.alert('Atenção', 'Adicione produtos ao carrinho');
      return;
    }
    setComandaEmPagamento(null);
    setFormaSelecionada(null);
    setValorRecebido('');
    setSenhaVale('');
    setClienteFiadoId(null);
    setClienteBusca('');
    setDescontoTipo('VALOR');
    setDescontoValor('');
    setSaqueVendaValor('');
    setCheckoutVisible(true);
  };

  const montarBodyVenda = ({ paymentLabel, amountReceived, change, valePassword, pendenteClientId }) => {
    const subtotal = calcularSubtotal();
    const descontoAmount = calcularDesconto(subtotal);
    const finalTotal = subtotal - descontoAmount;
    const cliente = clientes.find((c) => c.id === pendenteClientId);
    const saqueV = parseFloat(saqueVendaValor) || 0;

    return {
      items: carrinho.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.value,
        quantity: i.quantidade,
        unit: i.unit,
        maxQuantity: i.maxQuantity,
        ...(i.composicao
          ? { composicao: i.composicao, composicaoLabel: i.composicaoLabel }
          : {}),
      })),
      total: finalTotal,
      paymentMethod: paymentLabel,
      customerName: cliente?.name || 'Cliente não identificado',
      amountReceived: amountReceived != null ? amountReceived : finalTotal,
      change: change != null ? change : 0,
      date: new Date().toISOString(),
      discount:
        descontoAmount > 0
          ? { tipo: descontoTipo, valor: descontoAmount, cupomCodigo: null }
          : null,
      splitPayments: null,
      pendente: pendenteClientId ? { clientId: pendenteClientId } : null,
      vale: valePassword ? { password: valePassword } : null,
      saque: saqueV > 0 ? { valor: saqueV, taxa: taxaSaque } : null,
      subtotal,
      finalTotal,
    };
  };

  // Registra no Gastos Bar cada item pago com Vale
  const registrarGastosBarPorVale = async () => {
    const funcionario = user?.name || 'Operador';
    for (const item of carrinho) {
      const valorTotalItem = Number((item.value * item.quantidade).toFixed(2));
      try {
        await api.post('/api/pdv-gastos-bar', {
          tipo: 'PRODUTO',
          funcionario,
          descricao: item.name,
          quantidade: item.quantidade,
          valorUnitario: Number(item.value.toFixed(2)),
          valorTotal: valorTotalItem,
        });
      } catch (error) {
        console.error('Erro ao registrar gasto bar:', error);
      }
    }
  };

  const enviarVenda = async (body) => {
    const res = await api.post('/api/sales', body);
    return res.data;
  };

  // Fecha uma comanda (pagamento de comanda pendente)
  const fecharComanda = async (label) => {
    await api.put(`/api/pdv-comandas/${comandaEmPagamento.id}/fechar`, {
      paymentMethod: label,
    });
  };

  // Carrega os itens de uma comanda no carrinho e abre o checkout
  const iniciarPagamentoComanda = (comanda, clienteNome) => {
    const itens = (comanda.items || []).map((item, idx) => ({
      id: item.estoqueId || item.id,
      name: item.productName || item.name,
      value: item.unitPrice ?? item.price ?? 0,
      unit: item.unit || 'un',
      maxQuantity: item.quantity,
      quantidade: item.quantity,
      fromComanda: true,
      compostoKey: `comanda-${item.estoqueId || item.id}-${idx}`,
    }));
    setCarrinho(itens);
    setComandaEmPagamento({ ...comanda, clienteNome: clienteNome || comanda.clienteNome });
    setFormaSelecionada(null);
    setValorRecebido('');
    setSenhaVale('');
    setClienteFiadoId(null);
    setClienteBusca('');
    setDescontoTipo('VALOR');
    setDescontoValor('');
    setSaqueVendaValor('');
    setCheckoutVisible(true);
  };

  const finalizarComForma = async () => {
    if (!formaSelecionada) {
      Alert.alert('Atenção', 'Selecione uma forma de pagamento');
      return;
    }

    const tipo = tipoForma(formaSelecionada);
    const label = formaSelecionada.nome;
    const finalTotal = calcularTotalFinal();
    const saqueV = parseFloat(saqueVendaValor) || 0;
    const saqueFee = saqueV > 0 ? saqueV * (taxaSaque / 100) : 0;
    const totalCobrar = finalTotal + saqueV + saqueFee;

    // Validações específicas
    if (tipo === 'dinheiro') {
      const recebido = parseFloat(valorRecebido) || 0;
      if (recebido < totalCobrar) {
        Alert.alert('Atenção', 'Valor recebido é menor que o total');
        return;
      }
    }
    if (tipo === 'vale' && !senhaVale) {
      Alert.alert('Atenção', 'Informe a senha do vale');
      return;
    }
    if (tipo === 'fiado' && !clienteFiadoId) {
      Alert.alert('Atenção', 'Selecione um cliente para o fiado');
      return;
    }

    // Pix e Maquininha têm fluxo próprio (integração + polling),
    // válido também para pagamento de comanda.
    if (tipo === 'pix') {
      await iniciarPix(totalCobrar, label);
      return;
    }
    if (tipo === 'point') {
      await iniciarPagamentoPoint(formaSelecionada, totalCobrar, label);
      return;
    }

    // Fluxo direto (dinheiro / vale / fiado / outros)
    setLoading(true);
    try {
      if (comandaEmPagamento) {
        await fecharComanda(label);
      } else {
        const recebido = parseFloat(valorRecebido) || totalCobrar;
        const body = montarBodyVenda({
          paymentLabel: label,
          amountReceived: tipo === 'dinheiro' ? recebido : totalCobrar,
          change: tipo === 'dinheiro' ? recebido - totalCobrar : 0,
          valePassword: tipo === 'vale' ? senhaVale : null,
          pendenteClientId: tipo === 'fiado' ? clienteFiadoId : null,
        });
        await enviarVenda(body);
        if (tipo === 'vale') {
          await registrarGastosBarPorVale();
        }
      }

      Alert.alert('Sucesso', comandaEmPagamento ? 'Comanda paga!' : 'Venda finalizada!');
      finalizarLimpeza();
    } catch (error) {
      const msg = error.response?.data?.error || 'Erro ao finalizar pagamento';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  // Concretiza o pagamento após aprovação da máquina/Pix:
  // fecha a comanda OU cria a venda e vincula à order.
  const finalizarPagamentoAprovado = async (label, orderId) => {
    setLoading(true);
    try {
      if (comandaEmPagamento) {
        await fecharComanda(label);
      } else {
        const body = montarBodyVenda({ paymentLabel: label });
        const sale = await enviarVenda(body);
        if (orderId && sale?.id) {
          try {
            await api.patch(`/api/point/orders/${orderId}`, { saleId: sale.id });
          } catch (e) {
            console.log('Falha ao vincular venda à order (ignorado)');
          }
        }
      }
      Alert.alert('Sucesso', comandaEmPagamento ? 'Comanda paga!' : 'Venda finalizada!');
      setPointVisible(false);
      setPixVisible(false);
      finalizarLimpeza();
    } catch (error) {
      const msg = error.response?.data?.error || 'Erro ao finalizar pagamento';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const finalizarLimpeza = () => {
    const eraComanda = !!comandaEmPagamento;
    setCarrinho([]);
    setCheckoutVisible(false);
    setValorRecebido('');
    setSenhaVale('');
    setClienteFiadoId(null);
    setDescontoValor('');
    setSaqueVendaValor('');
    setComandaEmPagamento(null);
    if (eraComanda) {
      setSubTab('comandas');
      carregarComandas();
    }
    carregarProdutos();
  };

  // ---- Maquininha (Mercado Pago Point) ----
  const iniciarPagamentoPoint = async (forma, amount, label) => {
    setLoading(true);
    try {
      const res = await api.post('/api/point/orders', {
        amount,
        paymentType: forma.pointType || null, // "credit_card" | "debit_card" | null
        description: `Venda PDV - ${carrinho.length} item(ns)`,
        operator: user?.name || 'Operador',
      });
      pointOrderIdRef.current = res.data.id;
      setPointOrder(res.data);
      setPointStatus(res.data.status || 'waiting');
      setCheckoutVisible(false);
      setPointVisible(true);
      iniciarPollingPoint(res.data.id, label);
    } catch (error) {
      const msg =
        error.response?.data?.error || 'Não foi possível iniciar o pagamento na máquina';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const iniciarPollingPoint = (orderId, label) => {
    if (pointPollRef.current) clearInterval(pointPollRef.current);
    pointPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/point/orders/${orderId}`);
        const status = res.data.status;
        setPointStatus(status);
        if (status === 'processed' || status === 'finished') {
          clearInterval(pointPollRef.current);
          await finalizarPagamentoAprovado(label, orderId);
        } else if (['canceled', 'failed', 'expired', 'rejected'].includes(status)) {
          clearInterval(pointPollRef.current);
          Alert.alert('Máquina', 'Pagamento não concluído: ' + status);
          setPointVisible(false);
        }
      } catch (error) {
        console.error('Erro ao consultar pagamento da máquina:', error);
      }
    }, 3000);
  };

  const cancelarPoint = async () => {
    if (pointPollRef.current) clearInterval(pointPollRef.current);
    const orderId = pointOrderIdRef.current;
    if (orderId) {
      try {
        await api.post(`/api/point/orders/${orderId}/cancel`, {});
      } catch (e) {
        /* ignora */
      }
    }
    setPointVisible(false);
    setPointOrder(null);
  };

  // ---- Saque (troco via máquina) ----
  const saqueTaxaValor = (parseFloat(saqueValor) || 0) * (taxaSaque / 100);
  const saqueCobrarMaquina = (parseFloat(saqueValor) || 0) + saqueTaxaValor;

  const confirmarSaque = async () => {
    const valor = parseFloat(saqueValor);
    if (!valor || valor <= 0) {
      Alert.alert('Atenção', 'Informe um valor de saque válido');
      return;
    }
    const forma =
      formasPagamento.find((f) => f.id === saqueFormaId) || formasPagamento[0] || {};
    setSavingSaque(true);
    try {
      await api.post('/api/pdv-saque', {
        valor,
        observacao: saqueObs || null,
        formaPagamento: forma?.valor || 'dinheiro',
        formaPagamentoNome: forma?.nome || 'Dinheiro',
      });
      Alert.alert('Sucesso', 'Saque registrado!');
      setSaqueValor('');
      setSaqueObs('');
    } catch (error) {
      const msg = error.response?.data?.error || 'Erro ao registrar saque';
      Alert.alert('Erro', msg);
    } finally {
      setSavingSaque(false);
    }
  };

  // ---- Pix online ----
  const iniciarPix = async (amount, label) => {
    setLoading(true);
    try {
      const res = await api.post('/api/point/pix', {
        amount,
        description: `Venda PDV - ${carrinho.length} item(ns)`,
        operator: user?.name || 'Operador',
      });
      pixOrderIdRef.current = res.data.id;
      setPixData(res.data);
      setPixStatus(res.data.status || 'waiting');
      setCheckoutVisible(false);
      setPixVisible(true);
      iniciarPollingPix(res.data.id, amount, label);
    } catch (error) {
      const msg = error.response?.data?.error || 'Não foi possível gerar o Pix';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const iniciarPollingPix = (pixId, amount, label) => {
    if (pixPollRef.current) clearInterval(pixPollRef.current);
    pixPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/point/pix/${pixId}`);
        const status = res.data.status;
        setPixStatus(status);
        if (status === 'processed') {
          clearInterval(pixPollRef.current);
          await concluirVendaPix(pixId, label);
        } else if (['canceled', 'failed', 'expired'].includes(status)) {
          clearInterval(pixPollRef.current);
          Alert.alert('Pix', 'Pagamento não concluído: ' + status);
          setPixVisible(false);
        }
      } catch (error) {
        console.error('Erro ao consultar Pix:', error);
      }
    }, 3000);
  };

  const concluirVendaPix = async (pixId, label) => {
    await finalizarPagamentoAprovado(label, pixId);
  };

  const cancelarPix = () => {
    if (pixPollRef.current) clearInterval(pixPollRef.current);
    setPixVisible(false);
    setPixData(null);
  };

  const produtosFiltrados = produtos.filter((p) =>
    (p.name || '').toLowerCase().includes(busca.toLowerCase())
  );

  const subtotal = calcularSubtotal();
  const desconto = calcularDesconto(subtotal);
  const totalFinal = subtotal - desconto;
  const tipoSel = tipoForma(formaSelecionada);
  const saqueVendaNum = parseFloat(saqueVendaValor) || 0;
  const valorCobrado = totalFinal + saqueVendaNum * (1 + taxaSaque / 100);

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="PDV - Ponto de Venda" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      {/* Abas de sub-módulos (ações) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.subTabBar}
        contentContainerStyle={styles.subTabBarContent}
      >
        <Chip
          selected={subTab === 'venda'}
          onPress={() => setSubTab('venda')}
          style={styles.subTabChip}
          icon="cart"
        >
          Venda
        </Chip>
        {isAdmin && (
          <Chip
            selected={subTab === 'add'}
            onPress={() => {
              setSubTab('add');
              carregarOrigens();
              carregarOrigemSaldos();
            }}
            style={styles.subTabChip}
            icon="plus-box"
          >
            ADD
          </Chip>
        )}
        {isAdmin && (
          <Chip
            selected={subTab === 'vale'}
            onPress={() => {
              setSubTab('vale');
              carregarOrigens();
              carregarOrigemSaldos();
            }}
            style={styles.subTabChip}
            icon="cash-minus"
          >
            Vale
          </Chip>
        )}
        {isAdmin && (
          <Chip
            selected={subTab === 'premio'}
            onPress={() => {
              setSubTab('premio');
              carregarOrigemSaldos();
            }}
            style={styles.subTabChip}
            icon="trophy"
          >
            Prêmio
          </Chip>
        )}
        <Chip
          selected={subTab === 'comandas'}
          onPress={() => {
            setSubTab('comandas');
            carregarComandas();
          }}
          style={styles.subTabChip}
          icon="receipt"
        >
          Comandas
        </Chip>
        <Chip
          selected={subTab === 'saque'}
          onPress={() => setSubTab('saque')}
          style={styles.subTabChip}
          icon="cash-multiple"
        >
          Saque
        </Chip>
        <Chip
          selected={subTab === 'pedidos'}
          onPress={() => {
            setSubTab('pedidos');
            if (pedidosTab === 'online') carregarPedidosOnline();
            else carregarUltimosPedidos();
          }}
          style={styles.subTabChip}
          icon="history"
        >
          Pedidos
        </Chip>
        {isAdmin && (
          <Chip
            selected={subTab === 'config'}
            onPress={() => {
              setSubTab('config');
              carregarCupons();
            }}
            style={styles.subTabChip}
            icon="cog"
          >
            Config. Venda
          </Chip>
        )}
        {isAdmin && (
          <Chip
            selected={subTab === 'caixa'}
            onPress={abrirCaixaTab}
            style={styles.subTabChip}
            icon="cash-register"
          >
            Caixa
          </Chip>
        )}
      </ScrollView>

      {subTab === 'venda' && (
      <View style={styles.content}>
        <View style={styles.leftPanel}>
          <TextInput
            label="Buscar produto"
            value={busca}
            onChangeText={setBusca}
            mode="outlined"
            style={styles.searchInput}
            left={<TextInput.Icon icon="magnify" />}
          />

          <ScrollView style={styles.produtosList}>
            {(() => {
              // Agrupa produtos pelo productId (mesmo produto, unidades diferentes)
              const groups = {};
              produtosFiltrados.forEach((p) => {
                const key = p.productId != null ? `prod-${p.productId}` : `solo-${p.id}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
              });

              return Object.entries(groups).map(([key, items]) => {
                if (items.length === 1) {
                  const produto = items[0];
                  return (
                    <Card key={produto.id} style={styles.produtoCard}>
                      <Card.Content>
                        <View style={styles.produtoInfo}>
                          <View style={styles.produtoTexto}>
                            <Text style={styles.produtoNome}>{produto.name}</Text>
                            <Text style={styles.produtoUnidade}>
                              {produto.unit} · estoque: {produto.quantity}
                            </Text>
                            <Text style={styles.produtoPreco}>
                              R$ {formatarValor(produto.value || 0)}
                            </Text>
                          </View>
                          <IconButton
                            icon="plus"
                            mode="contained"
                            disabled={produto.quantity <= 0}
                            onPress={() => adicionarAoCarrinho(produto)}
                          />
                        </View>
                      </Card.Content>
                    </Card>
                  );
                }

                // Múltiplas unidades — mostra seletor de unidade
                const selectedId = selectedProductUnits[key] ?? items[0].id;
                const selecionado = items.find((i) => i.id === selectedId) || items[0];
                return (
                  <Card key={key} style={styles.produtoCard}>
                    <Card.Content>
                      <View style={styles.produtoInfo}>
                        <View style={styles.produtoTexto}>
                          <Text style={styles.produtoNome}>{selecionado.name}</Text>
                          <Text style={styles.produtoUnidade}>
                            {selecionado.unit} · estoque: {selecionado.quantity}
                          </Text>
                          <Text style={styles.produtoPreco}>
                            R$ {formatarValor(selecionado.value || 0)}
                          </Text>
                        </View>
                        <IconButton
                          icon="plus"
                          mode="contained"
                          disabled={selecionado.quantity <= 0}
                          onPress={() => adicionarAoCarrinho(selecionado)}
                        />
                      </View>
                      <View style={styles.unitOptionsRow}>
                        {items.map((item) => {
                          const ativo = selectedId === item.id;
                          const esgotado = item.quantity <= 0;
                          return (
                            <Chip
                              key={item.id}
                              compact
                              selected={ativo}
                              onPress={() =>
                                setSelectedProductUnits((prev) => ({ ...prev, [key]: item.id }))
                              }
                              style={[
                                styles.unitOptionChip,
                                ativo && styles.unitOptionChipActive,
                                esgotado && styles.unitOptionChipOut,
                              ]}
                              textStyle={styles.unitOptionChipText}
                            >
                              {item.unit} · R$ {formatarValor(item.value || 0)}
                              {esgotado ? ' ✕' : ''}
                            </Chip>
                          );
                        })}
                      </View>
                    </Card.Content>
                  </Card>
                );
              });
            })()}
          </ScrollView>
        </View>

        <View style={styles.rightPanel}>
          <Card style={styles.carrinhoCard}>
            <Card.Title title="Carrinho" titleStyle={{ color: '#fff' }} />
            <Divider />
            <Card.Content>
              {carrinho.length === 0 ? (
                <Text style={styles.carrinhoVazio}>Carrinho vazio</Text>
              ) : (
                <ScrollView style={styles.carrinhoLista}>
                  {carrinho.map((item) => (
                    <View key={item.compostoKey} style={styles.carrinhoItem}>
                      <View style={styles.carrinhoItemInfo}>
                        <Text style={styles.carrinhoItemNome}>
                          {item.name} ({item.unit})
                        </Text>
                        {item.composicaoLabel ? (
                          <Text style={styles.carrinhoItemComp}>{item.composicaoLabel}</Text>
                        ) : null}
                        <Text style={styles.carrinhoItemPreco}>
                          R$ {formatarValor(item.value * item.quantidade)}
                        </Text>
                      </View>
                      <View style={styles.carrinhoItemControls}>
                        <IconButton
                          icon="minus"
                          size={20}
                          onPress={() => removerDoCarrinho(item)}
                        />
                        <Text style={styles.quantidade}>{item.quantidade}</Text>
                        <IconButton
                          icon="plus"
                          size={20}
                          onPress={() => incrementarCarrinho(item)}
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </Card.Content>
          </Card>

          <Card style={styles.totalCard}>
            <Card.Content>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValor}>R$ {formatarValor(subtotal)}</Text>
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={abrirCheckout}
            loading={loading}
            disabled={loading || carrinho.length === 0}
            style={styles.finalizarButton}
            icon="cash-register"
          >
            Finalizar Venda
          </Button>
        </View>
      </View>
      )}

      {/* Sub-módulo: Comandas */}
      {subTab === 'comandas' && (
        <ScrollView style={styles.subModuloContainer}>
          <View style={styles.subModuloHeader}>
            <Text style={styles.subModuloTitulo}>Comandas pendentes</Text>
            <IconButton icon="refresh" iconColor="#fff" onPress={carregarComandas} />
          </View>
          {loadingComandas ? (
            <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 24 }} />
          ) : comandas.length === 0 ? (
            <Text style={styles.subModuloVazio}>Nenhuma comanda pendente.</Text>
          ) : (
            comandas.map((cliente) => (
              <Card key={cliente.id} style={styles.comandaCard}>
                <Card.Content>
                  <View style={styles.comandaClienteHeader}>
                    <Text style={styles.comandaCliente}>{cliente.name}</Text>
                    <Text style={styles.comandaClienteTotal}>
                      Em aberto: R$ {formatarValor(cliente.totalComandas || 0)}
                    </Text>
                  </View>
                  {(cliente.comandas || []).map((comanda) => (
                    <View key={comanda.id} style={styles.comandaSubCard}>
                      <View style={styles.comandaSubTop}>
                        <Text style={styles.comandaSubId}>#{comanda.id}</Text>
                        <Text style={styles.comandaSubValor}>
                          R$ {formatarValor(comanda.total || 0)}
                        </Text>
                      </View>
                      <Text style={styles.comandaInfo}>
                        {(comanda.items || []).length} item(ns)
                        {(comanda.items || []).length > 0
                          ? ` · ${(comanda.items || [])
                              .map((i) => `${i.quantity}x ${i.productName}`)
                              .join(', ')}`
                          : ''}
                      </Text>
                      <Button
                        mode="contained"
                        icon="cash"
                        compact
                        onPress={() => iniciarPagamentoComanda(comanda, cliente.name)}
                        style={styles.comandaPagarBtn}
                      >
                        Pagar comanda
                      </Button>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* Sub-módulo: Saque */}
      {subTab === 'saque' && (
        <ScrollView style={styles.subModuloContainer}>
          <Text style={styles.subModuloTitulo}>Saque (troco via máquina)</Text>
          <Card style={styles.saqueCard}>
            <Card.Content>
              <TextInput
                label="Valor do saque (R$)"
                mode="outlined"
                keyboardType="numeric"
                value={saqueValor}
                onChangeText={setSaqueValor}
                style={styles.saqueInput}
              />
              <Text style={styles.saqueInfo}>Taxa: {taxaSaque}%</Text>
              {parseFloat(saqueValor) > 0 && (
                <Text style={styles.saqueInfo}>
                  Cobrar na máquina: R$ {formatarValor(saqueCobrarMaquina)} (taxa R$ {formatarValor(saqueTaxaValor)})
                </Text>
              )}

              <Text style={styles.secaoLabel}>Forma de pagamento</Text>
              <View style={styles.formasContainer}>
                {formasPagamento.map((forma) => (
                  <Chip
                    key={forma.id}
                    selected={saqueFormaId === forma.id}
                    onPress={() => setSaqueFormaId(forma.id)}
                    style={styles.formaChip}
                    showSelectedCheck
                  >
                    {forma.nome}
                  </Chip>
                ))}
              </View>

              <TextInput
                label="Observação (opcional)"
                mode="outlined"
                value={saqueObs}
                onChangeText={setSaqueObs}
                style={styles.saqueInput}
              />

              <Button
                mode="contained"
                icon="cash-multiple"
                onPress={confirmarSaque}
                loading={savingSaque}
                disabled={savingSaque}
                style={styles.saqueButton}
              >
                Registrar saque
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* Sub-módulo: ADD (adicionar ao caixa) */}
      {subTab === 'add' && (
        <ScrollView style={styles.subModuloContainer}>
          <Text style={styles.subModuloTitulo}>Adicionar dinheiro ao caixa</Text>
          {origemSaldos.length > 0 && (
            <View style={styles.saldosRow}>
              {origemSaldos.map((s) => (
                <View key={s.id || s.nome} style={styles.saldoChip}>
                  <Text style={styles.saldoNome}>{s.nome}</Text>
                  <Text style={styles.saldoValor}>R$ {formatarValor(s.saldo ?? s.valor ?? 0)}</Text>
                </View>
              ))}
            </View>
          )}
          <Card style={styles.saqueCard}>
            <Card.Content>
              <TextInput
                label="Valor total (R$)"
                mode="outlined"
                keyboardType="numeric"
                value={addValorTotal}
                onChangeText={setAddValorTotal}
                style={styles.saqueInput}
              />
              <Text style={styles.secaoLabel}>Origens</Text>
              <OrigemRows origens={addOrigens} setOrigens={setAddOrigens} origensDisponiveis={origensDisponiveis} />
              <Text
                style={[
                  styles.saqueInfo,
                  Math.abs(somaOrigens(addOrigens) - (parseFloat(addValorTotal) || 0)) < 0.01
                    ? styles.somaOk
                    : styles.somaErro,
                ]}
              >
                Soma das origens: R$ {formatarValor(somaOrigens(addOrigens))}
              </Text>
              <TextInput
                label="Observação (opcional)"
                mode="outlined"
                value={addObs}
                onChangeText={setAddObs}
                style={styles.saqueInput}
              />
              <Button
                mode="contained"
                icon="plus-box"
                onPress={confirmarAdd}
                loading={savingAdd}
                disabled={savingAdd}
                style={styles.saqueButton}
              >
                Adicionar ao caixa
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* Sub-módulo: Vale (retirada do caixa) */}
      {subTab === 'vale' && (
        <ScrollView style={styles.subModuloContainer}>
          <Text style={styles.subModuloTitulo}>Vale / Retirada do caixa</Text>
          {origemSaldos.length > 0 && (
            <View style={styles.saldosRow}>
              {origemSaldos.map((s) => (
                <View key={s.id || s.nome} style={styles.saldoChip}>
                  <Text style={styles.saldoNome}>{s.nome}</Text>
                  <Text style={styles.saldoValor}>R$ {formatarValor(s.saldo ?? s.valor ?? 0)}</Text>
                </View>
              ))}
            </View>
          )}
          <Card style={styles.saqueCard}>
            <Card.Content>
              <TextInput
                label="Valor do vale (R$)"
                mode="outlined"
                keyboardType="numeric"
                value={valeValorTotal}
                onChangeText={setValeValorTotal}
                style={styles.saqueInput}
              />
              <Text style={styles.secaoLabel}>Origens (de onde sai o dinheiro)</Text>
              <OrigemRows origens={valeOrigens} setOrigens={setValeOrigens} origensDisponiveis={origensDisponiveis} />
              <Text style={styles.saqueInfo}>
                Soma dos destinos: R$ {formatarValor(somaOrigens(valeOrigens))}
              </Text>
              <TextInput
                label="Observação (opcional)"
                mode="outlined"
                value={valeObs}
                onChangeText={setValeObs}
                style={styles.saqueInput}
              />
              <Button
                mode="contained"
                icon="cash-minus"
                onPress={confirmarVale}
                loading={savingVale}
                disabled={savingVale}
                style={[styles.saqueButton, { backgroundColor: '#e53935' }]}
              >
                Registrar vale
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* Sub-módulo: Prêmio */}
      {subTab === 'premio' && (
        <ScrollView style={styles.subModuloContainer}>
          <Text style={styles.subModuloTitulo}>Registrar prêmio</Text>
          <Text style={styles.stepIndicator}>Etapa {premioStep} de 3</Text>
          <Card style={styles.saqueCard}>
            <Card.Content>
              {premioStep === 1 && (
                <>
                  <Text style={styles.saqueInfo}>
                    Anexe a foto que comprova o ganho do cliente na máquina.
                  </Text>
                  {premioImagem1 ? (
                    <View>
                      <Image source={{ uri: premioImagem1 }} style={styles.premioPreview} resizeMode="contain" />
                      <Button mode="text" textColor="#ff6b6b" onPress={() => setPremioImagem1(null)}>
                        Remover imagem
                      </Button>
                    </View>
                  ) : (
                    <Button
                      mode="outlined"
                      icon="camera"
                      onPress={() => anexarImagemPremio(setPremioImagem1)}
                      textColor="#2196F3"
                      style={{ marginTop: 8 }}
                    >
                      Anexar comprovante do ganho
                    </Button>
                  )}
                  <Button
                    mode="contained"
                    onPress={() => premioAvancar(2)}
                    disabled={!premioImagem1}
                    style={styles.saqueButton}
                  >
                    Avançar
                  </Button>
                </>
              )}

              {premioStep === 2 && (
                <>
                  <Text style={styles.saqueInfo}>
                    Anexe a foto da baixa do valor no jogo, informe o valor e a(s) origem(ns).
                  </Text>
                  {premioImagem2 ? (
                    <View>
                      <Image source={{ uri: premioImagem2 }} style={styles.premioPreview} resizeMode="contain" />
                      <Button mode="text" textColor="#ff6b6b" onPress={() => setPremioImagem2(null)}>
                        Remover imagem
                      </Button>
                    </View>
                  ) : (
                    <Button
                      mode="outlined"
                      icon="camera"
                      onPress={() => anexarImagemPremio(setPremioImagem2)}
                      textColor="#2196F3"
                      style={{ marginVertical: 8 }}
                    >
                      Anexar comprovante da baixa
                    </Button>
                  )}
                  <TextInput
                    label="Valor do prêmio (R$)"
                    mode="outlined"
                    keyboardType="numeric"
                    value={premioValor}
                    onChangeText={setPremioValor}
                    style={styles.saqueInput}
                  />
                  <Text style={styles.secaoLabel}>Origens</Text>
                  <OrigemRows origens={premioOrigens} setOrigens={setPremioOrigens} origensDisponiveis={origemSaldos} />
                  <Text style={styles.saqueInfo}>
                    Soma das origens: R$ {formatarValor(somaOrigens(premioOrigens))}
                  </Text>
                  <TextInput
                    label="Observação (opcional)"
                    mode="outlined"
                    value={premioObs}
                    onChangeText={setPremioObs}
                    style={styles.saqueInput}
                  />
                  <View style={styles.premioBotoes}>
                    <Button mode="outlined" onPress={() => setPremioStep(1)} textColor="#fff">
                      Voltar
                    </Button>
                    <Button mode="contained" onPress={() => premioAvancar(3)} style={styles.confirmarButton}>
                      Avançar
                    </Button>
                  </View>
                </>
              )}

              {premioStep === 3 && (
                <>
                  <Text style={styles.saqueInfo}>Revise as informações antes de confirmar:</Text>
                  <View style={styles.premioConfirmImgs}>
                    {premioImagem1 && <Image source={{ uri: premioImagem1 }} style={styles.premioThumb} />}
                    {premioImagem2 && <Image source={{ uri: premioImagem2 }} style={styles.premioThumb} />}
                  </View>
                  <Text style={styles.resumoTexto}>Valor: R$ {formatarValor(parseFloat(premioValor) || 0)}</Text>
                  {somaOrigens(premioOrigens) > 0 && (
                    <Text style={styles.resumoTexto}>
                      Origens: R$ {formatarValor(somaOrigens(premioOrigens))}
                    </Text>
                  )}
                  {premioObs ? <Text style={styles.resumoTexto}>Obs: {premioObs}</Text> : null}
                  <View style={styles.premioBotoes}>
                    <Button mode="outlined" onPress={() => setPremioStep(2)} textColor="#fff">
                      Voltar
                    </Button>
                    <Button
                      mode="contained"
                      onPress={confirmarPremio}
                      loading={savingPremio}
                      disabled={savingPremio}
                      style={styles.confirmarButton}
                    >
                      Confirmar prêmio
                    </Button>
                  </View>
                </>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* Sub-módulo: Pedidos */}
      {subTab === 'pedidos' && (
        <ScrollView style={styles.subModuloContainer}>
          <View style={styles.configSubtabs}>
            <Chip
              selected={pedidosTab === 'historico'}
              onPress={() => {
                setPedidosTab('historico');
                carregarUltimosPedidos();
              }}
              style={styles.subTabChip}
            >
              Histórico
            </Chip>
            <Chip
              selected={pedidosTab === 'online'}
              onPress={() => {
                setPedidosTab('online');
                carregarPedidosOnline();
              }}
              style={styles.subTabChip}
            >
              Online
            </Chip>
          </View>

          {pedidosTab === 'historico' && (
            <>
              <View style={styles.dataFiltroRow}>
                <TextInput
                  label="Início (AAAA-MM-DD)"
                  mode="outlined"
                  dense
                  value={pedidosDataInicio}
                  onChangeText={setPedidosDataInicio}
                  style={styles.dataInput}
                />
                <TextInput
                  label="Fim (AAAA-MM-DD)"
                  mode="outlined"
                  dense
                  value={pedidosDataFim}
                  onChangeText={setPedidosDataFim}
                  style={styles.dataInput}
                />
              </View>
              <Button mode="contained" icon="magnify" onPress={carregarUltimosPedidos} style={{ marginBottom: 12 }}>
                Buscar
              </Button>
              {loadingPedidos ? (
                <ActivityIndicator color="#2196F3" style={{ marginTop: 16 }} />
              ) : ultimosPedidos.length === 0 ? (
                <Text style={styles.subModuloVazio}>Nenhum pedido no período.</Text>
              ) : (
                ultimosPedidos.map((p) => (
                  <Card key={p.id} style={styles.comandaCard}>
                    <Card.Content>
                      <Text style={styles.comandaCliente}>
                        {p.customerName || 'Cliente'} — R$ {formatarValor(p.total || 0)}
                      </Text>
                      <Text style={styles.comandaInfo}>
                        {p.paymentMethod || ''} · {p.date ? new Date(p.date).toLocaleString('pt-BR') : ''}
                      </Text>
                      {(p.items || []).map((it, idx) => (
                        <Text key={idx} style={styles.pedidoItem}>
                          {it.quantity}x {it.name}
                        </Text>
                      ))}
                    </Card.Content>
                  </Card>
                ))
              )}
            </>
          )}

          {pedidosTab === 'online' && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.configSubtabs}>
                <Chip
                  selected={onlineStatusFiltro === ''}
                  onPress={() => {
                    setOnlineStatusFiltro('');
                    carregarPedidosOnline('');
                  }}
                  style={styles.subTabChip}
                >
                  Todos
                </Chip>
                {Object.keys(PEDIDO_STATUS_LABELS).map((st) => (
                  <Chip
                    key={st}
                    selected={onlineStatusFiltro === st}
                    onPress={() => {
                      setOnlineStatusFiltro(st);
                      carregarPedidosOnline(st);
                    }}
                    style={styles.subTabChip}
                  >
                    {PEDIDO_STATUS_LABELS[st]}
                  </Chip>
                ))}
              </ScrollView>
              {loadingOnline ? (
                <ActivityIndicator color="#2196F3" style={{ marginTop: 16 }} />
              ) : pedidosOnline.length === 0 ? (
                <Text style={styles.subModuloVazio}>Nenhum pedido online.</Text>
              ) : (
                pedidosOnline.map((p) => {
                  const prox = proximoStatus(p.statusPedido);
                  return (
                    <Card key={p.id} style={styles.comandaCard}>
                      <Card.Content>
                        <Text style={styles.comandaCliente}>
                          #{p.id} — {p.customerName || 'Cliente'}
                        </Text>
                        <Text style={styles.comandaInfo}>
                          R$ {formatarValor(p.total || 0)} · {PEDIDO_STATUS_LABELS[p.statusPedido] || p.statusPedido}
                        </Text>
                        {(p.items || []).map((it, idx) => (
                          <Text key={idx} style={styles.pedidoItem}>
                            {it.quantity}x {it.name}
                          </Text>
                        ))}
                        <View style={styles.pedidoAcoes}>
                          {prox && (
                            <Button
                              mode="contained"
                              compact
                              loading={atualizandoStatusId === p.id}
                              disabled={atualizandoStatusId === p.id}
                              onPress={() => atualizarStatusOnline(p.id, prox)}
                              style={styles.confirmarButton}
                            >
                              {PEDIDO_STATUS_LABELS[prox]}
                            </Button>
                          )}
                          {p.statusPedido !== 'cancelled' && p.statusPedido !== 'delivered' && (
                            <Button
                              mode="outlined"
                              compact
                              textColor="#ff6b6b"
                              onPress={() => atualizarStatusOnline(p.id, 'cancelled')}
                            >
                              Cancelar
                            </Button>
                          )}
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Sub-módulo: Config. Venda */}
      {subTab === 'config' && (
        <ScrollView style={styles.subModuloContainer}>
          <Text style={styles.subModuloTitulo}>Configurações de Venda</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.configSubtabs}>
            {[
              ['cupons', 'Cupons'],
              ['taxas', 'Taxas'],
              ['limites', 'Limites'],
              ['formas', 'Formas Pgto'],
              ['saque', 'Saque'],
              ['origens', 'Origens'],
            ].map(([k, label]) => (
              <Chip
                key={k}
                selected={configTab === k}
                onPress={() => {
                  setConfigTab(k);
                  if (k === 'cupons') carregarCupons();
                  if (k === 'taxas') carregarTaxas();
                  if (k === 'limites') carregarConfigLimites();
                  if (k === 'formas') carregarFormasConfig();
                  if (k === 'origens') {
                    carregarOrigens();
                    carregarOrigemSaldos();
                  }
                }}
                style={styles.subTabChip}
              >
                {label}
              </Chip>
            ))}
          </ScrollView>

          {configTab === 'cupons' && (
            <Card style={styles.saqueCard}>
              <Card.Content>
                <TextInput
                  label="Código"
                  mode="outlined"
                  dense
                  value={novoCupom.codigo}
                  onChangeText={(v) => setNovoCupom({ ...novoCupom, codigo: v })}
                  style={styles.saqueInput}
                />
                <View style={styles.tipoRow}>
                  <Chip
                    selected={novoCupom.tipo === 'PERCENTUAL'}
                    onPress={() => setNovoCupom({ ...novoCupom, tipo: 'PERCENTUAL' })}
                    style={styles.chip}
                  >
                    %
                  </Chip>
                  <Chip
                    selected={novoCupom.tipo === 'FIXO'}
                    onPress={() => setNovoCupom({ ...novoCupom, tipo: 'FIXO' })}
                    style={styles.chip}
                  >
                    R$
                  </Chip>
                  <TextInput
                    label="Valor"
                    mode="outlined"
                    dense
                    keyboardType="numeric"
                    value={novoCupom.valor}
                    onChangeText={(v) => setNovoCupom({ ...novoCupom, valor: v })}
                    style={styles.flexInput}
                  />
                </View>
                <View style={styles.tipoRow}>
                  <TextInput
                    label="Válido até (AAAA-MM-DD)"
                    mode="outlined"
                    dense
                    value={novoCupom.validoAte}
                    onChangeText={(v) => setNovoCupom({ ...novoCupom, validoAte: v })}
                    style={styles.flexInput}
                  />
                  <TextInput
                    label="Limite"
                    mode="outlined"
                    dense
                    keyboardType="numeric"
                    value={novoCupom.limiteUso}
                    onChangeText={(v) => setNovoCupom({ ...novoCupom, limiteUso: v })}
                    style={styles.smallInput}
                  />
                </View>
                <Button mode="contained" icon="plus" onPress={criarCupom} style={styles.saqueButton}>
                  Criar cupom
                </Button>
                <Divider style={styles.divider} />
                {cupons.length === 0 ? (
                  <Text style={styles.subModuloVazio}>Nenhum cupom cadastrado.</Text>
                ) : (
                  cupons.map((c) => (
                    <View key={c.id} style={styles.configItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.configItemNome}>
                          {c.codigo} {c.ativo ? '' : '(inativo)'}
                        </Text>
                        <Text style={styles.configItemSub}>
                          {c.tipo === 'PERCENTUAL' ? `${c.valor}%` : `R$ ${formatarValor(c.valor)}`}
                        </Text>
                      </View>
                      <IconButton
                        icon={c.ativo ? 'toggle-switch' : 'toggle-switch-off'}
                        iconColor={c.ativo ? '#4caf50' : '#999'}
                        onPress={() => toggleCupom(c.id, c.ativo)}
                      />
                      <IconButton icon="delete" iconColor="#ff6b6b" onPress={() => excluirCupom(c.id)} />
                    </View>
                  ))
                )}
              </Card.Content>
            </Card>
          )}

          {configTab === 'taxas' && (
            <Card style={styles.saqueCard}>
              <Card.Content>
                <TextInput
                  label="Nome da taxa"
                  mode="outlined"
                  dense
                  value={novaTaxa.nome}
                  onChangeText={(v) => setNovaTaxa({ ...novaTaxa, nome: v })}
                  style={styles.saqueInput}
                />
                <View style={styles.tipoRow}>
                  <Chip
                    selected={novaTaxa.tipo === 'PERCENTUAL'}
                    onPress={() => setNovaTaxa({ ...novaTaxa, tipo: 'PERCENTUAL' })}
                    style={styles.chip}
                  >
                    %
                  </Chip>
                  <Chip
                    selected={novaTaxa.tipo === 'FIXO'}
                    onPress={() => setNovaTaxa({ ...novaTaxa, tipo: 'FIXO' })}
                    style={styles.chip}
                  >
                    R$
                  </Chip>
                  <TextInput
                    label="Valor"
                    mode="outlined"
                    dense
                    keyboardType="numeric"
                    value={novaTaxa.valor}
                    onChangeText={(v) => setNovaTaxa({ ...novaTaxa, valor: v })}
                    style={styles.flexInput}
                  />
                </View>
                <Button mode="contained" icon="plus" onPress={criarTaxa} style={styles.saqueButton}>
                  Criar taxa
                </Button>
                <Divider style={styles.divider} />
                {taxas.length === 0 ? (
                  <Text style={styles.subModuloVazio}>Nenhuma taxa cadastrada.</Text>
                ) : (
                  taxas.map((t) => (
                    <View key={t.id} style={styles.configItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.configItemNome}>
                          {t.nome} {t.ativo ? '' : '(inativa)'}
                        </Text>
                        <Text style={styles.configItemSub}>
                          {t.tipo === 'PERCENTUAL' ? `${t.valor}%` : `R$ ${formatarValor(t.valor)}`}
                        </Text>
                      </View>
                      <IconButton
                        icon={t.ativo ? 'toggle-switch' : 'toggle-switch-off'}
                        iconColor={t.ativo ? '#4caf50' : '#999'}
                        onPress={() => toggleTaxa(t.id, t.ativo)}
                      />
                      <IconButton icon="delete" iconColor="#ff6b6b" onPress={() => excluirTaxa(t.id)} />
                    </View>
                  ))
                )}
              </Card.Content>
            </Card>
          )}

          {configTab === 'limites' && (
            <Card style={styles.saqueCard}>
              <Card.Content>
                {configLimites.length === 0 ? (
                  <Text style={styles.subModuloVazio}>Nenhuma configuração.</Text>
                ) : (
                  configLimites.map((cfg) => (
                    <View key={cfg.chave} style={styles.limiteRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.configItemNome}>{cfg.descricao || cfg.chave}</Text>
                        <TextInput
                          mode="outlined"
                          dense
                          keyboardType="numeric"
                          value={limiteEdits[cfg.chave] ?? String(cfg.valor ?? '')}
                          onChangeText={(v) => setLimiteEdits({ ...limiteEdits, [cfg.chave]: v })}
                          style={styles.saqueInput}
                        />
                      </View>
                      <IconButton
                        icon="content-save"
                        iconColor="#4caf50"
                        onPress={() =>
                          salvarLimite(cfg.chave, limiteEdits[cfg.chave] ?? String(cfg.valor ?? ''), cfg.descricao)
                        }
                      />
                    </View>
                  ))
                )}
              </Card.Content>
            </Card>
          )}

          {configTab === 'formas' && (
            <Card style={styles.saqueCard}>
              <Card.Content>
                <View style={styles.tipoRow}>
                  <TextInput
                    label="Nova forma de pagamento"
                    mode="outlined"
                    dense
                    value={novaFormaNome}
                    onChangeText={setNovaFormaNome}
                    style={styles.flexInput}
                  />
                  <IconButton icon="plus" iconColor="#4caf50" onPress={criarFormaConfig} />
                </View>
                <Divider style={styles.divider} />
                {formasConfig.length === 0 ? (
                  <Text style={styles.subModuloVazio}>Nenhuma forma cadastrada.</Text>
                ) : (
                  formasConfig.map((f) => (
                    <View key={f.id} style={styles.formaConfigBlock}>
                      <View style={styles.configItemRow}>
                        <Text style={[styles.configItemNome, { flex: 1 }]}>
                          {f.nome} {f.ativo === false ? '(inativa)' : ''}
                        </Text>
                        <IconButton
                          icon={f.ativo === false ? 'toggle-switch-off' : 'toggle-switch'}
                          iconColor={f.ativo === false ? '#999' : '#4caf50'}
                          onPress={() => toggleFormaConfig(f.id, f.ativo)}
                        />
                        <IconButton icon="delete" iconColor="#ff6b6b" onPress={() => excluirFormaConfig(f.id)} />
                      </View>
                      <View style={styles.formaPointRow}>
                        <Checkbox.Android
                          status={f.pointEnabled ? 'checked' : 'unchecked'}
                          color="#2196F3"
                          disabled={!pointConfig?.tokenConfigured}
                          onPress={() => togglePointForma(f.id, 'pointEnabled', !f.pointEnabled)}
                        />
                        <Text style={styles.formaPointLabel}>
                          Maquininha (Point){!pointConfig?.tokenConfigured ? ' — indisponível' : ''}
                        </Text>
                      </View>
                      {f.pointEnabled && (
                        <View style={styles.formaPointPickerWrap}>
                          <Picker
                            selectedValue={f.pointType || ''}
                            onValueChange={(v) => togglePointForma(f.id, 'pointType', v || null)}
                            style={styles.formaPointPicker}
                            dropdownIconColor="#fff"
                          >
                            <Picker.Item label="Cliente escolhe no terminal" value="" color="#000" />
                            <Picker.Item label="Crédito" value="credit_card" color="#000" />
                            <Picker.Item label="Débito" value="debit_card" color="#000" />
                            <Picker.Item label="Pix (QR na tela)" value="pix_online" color="#000" />
                          </Picker>
                        </View>
                      )}
                      <Divider style={styles.formaConfigDivider} />
                    </View>
                  ))
                )}

                {/* Maquininha Mercado Pago Point */}
                <Divider style={styles.divider} />
                <Text style={styles.pointConfigTitulo}>Maquininha Mercado Pago Point</Text>
                {!pointConfig?.tokenConfigured ? (
                  <Text style={styles.saqueInfo}>
                    A integração com a maquininha ainda não está disponível. Verifique se o
                    token do Mercado Pago (MP_ACCESS_TOKEN) foi configurado no servidor.
                  </Text>
                ) : (
                  <>
                    <Button
                      mode="contained"
                      icon="magnify"
                      onPress={buscarMaquininhas}
                      loading={loadingPointTerminals}
                      disabled={loadingPointTerminals}
                      style={{ marginTop: 8 }}
                    >
                      Buscar maquininhas
                    </Button>
                    <Text style={styles.pointTerminalAtual}>
                      Terminal atual:{' '}
                      <Text style={styles.pointTerminalAtualId}>
                        {pointConfig.terminal_id || 'não definido'}
                      </Text>
                    </Text>

                    {pointTerminals.map((t) => {
                      const selecionado = pointConfig.terminal_id === t.id;
                      return (
                        <View
                          key={t.id}
                          style={[
                            styles.pointTerminalRow,
                            selecionado && styles.pointTerminalRowSel,
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pointTerminalId}>{t.id}</Text>
                            <Text style={styles.pointTerminalModo}>
                              Modo: {t.operating_mode || '-'}
                            </Text>
                          </View>
                          <View style={styles.pointTerminalAcoes}>
                            <Button
                              mode={selecionado ? 'contained' : 'outlined'}
                              compact
                              disabled={savingPointConfig}
                              onPress={() => salvarPointConfig({ terminal_id: t.id })}
                              textColor={selecionado ? undefined : '#fff'}
                            >
                              {selecionado ? '✓ Selecionado' : 'Selecionar'}
                            </Button>
                            {t.operating_mode !== 'PDV' && (
                              <Button
                                mode="text"
                                compact
                                onPress={() => setPointTerminalMode(t.id, 'PDV')}
                              >
                                Ativar modo PDV
                              </Button>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    <View style={styles.formaPointRow}>
                      <Checkbox.Android
                        status={
                          pointConfig.print_on_terminal === 'seller_ticket'
                            ? 'checked'
                            : 'unchecked'
                        }
                        color="#2196F3"
                        onPress={() =>
                          salvarPointConfig({
                            print_on_terminal:
                              pointConfig.print_on_terminal === 'seller_ticket'
                                ? 'no_ticket'
                                : 'seller_ticket',
                          })
                        }
                      />
                      <Text style={styles.formaPointLabel}>
                        Imprimir comprovante no terminal
                      </Text>
                    </View>

                    <View style={styles.pointParcelasRow}>
                      <Text style={styles.formaPointLabel}>Parcelas padrão (crédito):</Text>
                      <TextInput
                        mode="outlined"
                        dense
                        keyboardType="number-pad"
                        value={String(pointConfig.default_installments || 1)}
                        onChangeText={(v) =>
                          setPointConfig({
                            ...pointConfig,
                            default_installments: parseInt(v, 10) || 1,
                          })
                        }
                        onBlur={() =>
                          salvarPointConfig({
                            default_installments: pointConfig.default_installments || 1,
                          })
                        }
                        style={styles.pointParcelasInput}
                      />
                    </View>
                  </>
                )}
              </Card.Content>
            </Card>
          )}

          {configTab === 'saque' && (
            <Card style={styles.saqueCard}>
              <Card.Content>
                <Text style={styles.configItemNome}>Taxa de saque atual: {taxaSaque}%</Text>
                <Text style={styles.saqueInfo}>
                  Ex.: cliente quer R$ 40,00 → cobra R$ {formatarValor(40 + 40 * (taxaSaque / 100))} na máquina.
                </Text>
                <TextInput
                  label="Nova taxa (%)"
                  mode="outlined"
                  keyboardType="numeric"
                  value={taxaSaqueInput}
                  onChangeText={setTaxaSaqueInput}
                  style={styles.saqueInput}
                />
                <Button
                  mode="contained"
                  icon="content-save"
                  onPress={salvarTaxaSaque}
                  loading={savingTaxaSaque}
                  disabled={savingTaxaSaque}
                  style={styles.saqueButton}
                >
                  Salvar taxa
                </Button>
              </Card.Content>
            </Card>
          )}

          {configTab === 'origens' && (
            <>
              <View style={styles.saldosRow}>
                {origemSaldos.map((s) => (
                  <View key={s.id || s.nome} style={styles.saldoChip}>
                    <Text style={styles.saldoNome}>{s.nome}</Text>
                    <Text style={styles.saldoValor}>R$ {formatarValor(s.saldo ?? s.valor ?? 0)}</Text>
                  </View>
                ))}
              </View>

              <Card style={styles.saqueCard}>
                <Card.Content>
                  <Text style={styles.secaoLabel}>Gerenciar origens</Text>
                  <View style={styles.tipoRow}>
                    <TextInput
                      label="Nova origem"
                      mode="outlined"
                      dense
                      value={novaOrigemNome}
                      onChangeText={setNovaOrigemNome}
                      style={styles.flexInput}
                    />
                    <IconButton icon="plus" iconColor="#4caf50" onPress={criarOrigem} />
                  </View>
                  {origensDisponiveis.map((o) => (
                    <View key={o.id || o.nome} style={styles.configItemRow}>
                      <Text style={[styles.configItemNome, { flex: 1 }]}>{o.nome}</Text>
                      <IconButton icon="delete" iconColor="#ff6b6b" onPress={() => excluirOrigem(o.id)} />
                    </View>
                  ))}
                </Card.Content>
              </Card>

              <Card style={styles.saqueCard}>
                <Card.Content>
                  <Text style={styles.secaoLabel}>Movimentar origem</Text>
                  <View style={styles.origemPickerWrap}>
                    <Picker
                      selectedValue={origemMovNome}
                      onValueChange={setOrigemMovNome}
                      dropdownIconColor="#fff"
                      style={styles.origemPicker}
                    >
                      <Picker.Item label="Selecione a origem..." value="" color="#999" />
                      {origensDisponiveis.map((o) => (
                        <Picker.Item key={o.id || o.nome} label={o.nome} value={o.nome} />
                      ))}
                    </Picker>
                  </View>
                  <View style={styles.tipoRow}>
                    {['ENTRADA', 'SAIDA', 'AJUSTE'].map((tp) => (
                      <Chip
                        key={tp}
                        selected={origemMovTipo === tp}
                        onPress={() => setOrigemMovTipo(tp)}
                        style={styles.chip}
                      >
                        {tp}
                      </Chip>
                    ))}
                  </View>
                  <TextInput
                    label="Valor (R$)"
                    mode="outlined"
                    dense
                    keyboardType="numeric"
                    value={origemMovValor}
                    onChangeText={setOrigemMovValor}
                    style={styles.saqueInput}
                  />
                  <TextInput
                    label="Descrição (opcional)"
                    mode="outlined"
                    dense
                    value={origemMovDesc}
                    onChangeText={setOrigemMovDesc}
                    style={styles.saqueInput}
                  />
                  <Button mode="contained" icon="cash-sync" onPress={origemMovimentar} style={styles.saqueButton}>
                    Registrar movimentação
                  </Button>
                </Card.Content>
              </Card>

              <Card style={styles.saqueCard}>
                <Card.Content>
                  <Text style={styles.secaoLabel}>Transferir entre origens</Text>
                  <View style={styles.origemPickerWrap}>
                    <Picker
                      selectedValue={transfFrom}
                      onValueChange={setTransfFrom}
                      dropdownIconColor="#fff"
                      style={styles.origemPicker}
                    >
                      <Picker.Item label="Origem..." value="" color="#999" />
                      {origensDisponiveis.map((o) => (
                        <Picker.Item key={o.id || o.nome} label={o.nome} value={o.nome} />
                      ))}
                    </Picker>
                  </View>
                  <View style={styles.origemPickerWrap}>
                    <Picker
                      selectedValue={transfTo}
                      onValueChange={setTransfTo}
                      dropdownIconColor="#fff"
                      style={styles.origemPicker}
                    >
                      <Picker.Item label="Destino..." value="" color="#999" />
                      {origensDisponiveis.map((o) => (
                        <Picker.Item key={o.id || o.nome} label={o.nome} value={o.nome} />
                      ))}
                    </Picker>
                  </View>
                  <TextInput
                    label="Valor (R$)"
                    mode="outlined"
                    dense
                    keyboardType="numeric"
                    value={transfValor}
                    onChangeText={setTransfValor}
                    style={styles.saqueInput}
                  />
                  <TextInput
                    label="Descrição (opcional)"
                    mode="outlined"
                    dense
                    value={transfDesc}
                    onChangeText={setTransfDesc}
                    style={styles.saqueInput}
                  />
                  <Button mode="contained" icon="bank-transfer" onPress={origemTransferir} style={styles.saqueButton}>
                    Transferir
                  </Button>
                </Card.Content>
              </Card>
            </>
          )}
        </ScrollView>
      )}

      {/* Sub-módulo: Caixa (sub-caixa diário) */}
      {subTab === 'caixa' && (
        <View style={styles.subModuloContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.caixaSubTabBar}
            contentContainerStyle={styles.subTabBarContent}
          >
            {[
              { k: 'atual', label: 'Caixa Atual', icon: 'cash' },
              { k: 'historico', label: 'Histórico', icon: 'history' },
              { k: 'gastosbar', label: 'Gastos Bar', icon: 'glass-mug-variant' },
              { k: 'origens', label: 'Origens', icon: 'layers' },
            ].map((t) => (
              <Chip
                key={t.k}
                selected={caixaSubTab === t.k}
                icon={t.icon}
                style={styles.subTabChip}
                onPress={() => {
                  setCaixaSubTab(t.k);
                  if (t.k === 'atual') carregarCaixaAtual();
                  if (t.k === 'historico') carregarCaixaHistorico();
                  if (t.k === 'gastosbar') carregarGastosBar();
                  if (t.k === 'origens') carregarOrigemSaldos();
                }}
              >
                {t.label}
              </Chip>
            ))}
          </ScrollView>

          <ScrollView style={styles.caixaContent}>
            {/* ---- CAIXA ATUAL ---- */}
            {caixaSubTab === 'atual' && (
              caixaAtual && caixaAtual.status === 'ABERTO' ? (
                <>
                  <Card style={styles.caixaCard}>
                    <Card.Content>
                      <View style={styles.caixaStatusRow}>
                        <Chip icon="door-open" style={styles.caixaBadgeAberto} textStyle={{ color: '#fff' }}>
                          ABERTO
                        </Chip>
                        <Text style={styles.caixaStatusTime}>
                          {new Date(caixaAtual.abertoEm).toLocaleString('pt-BR')}
                        </Text>
                      </View>
                      <View style={styles.caixaResumoGrid}>
                        <View style={styles.caixaResumoItem}>
                          <Text style={styles.caixaResumoLabel}>Saldo Inicial</Text>
                          <Text style={styles.caixaResumoValor}>
                            R$ {formatarValor((caixaAtual.saldoInicial || 0) + (caixaAtual.totalAdd || 0))}
                          </Text>
                        </View>
                        <View style={styles.caixaResumoItem}>
                          <Text style={styles.caixaResumoLabel}>Entradas</Text>
                          <Text style={[styles.caixaResumoValor, { color: '#4caf50' }]}>
                            R$ {formatarValor((caixaAtual.totalEntradas || 0) - (caixaAtual.totalAdd || 0))}
                          </Text>
                        </View>
                        <View style={styles.caixaResumoItem}>
                          <Text style={styles.caixaResumoLabel}>Saídas</Text>
                          <Text style={[styles.caixaResumoValor, { color: '#ff6b6b' }]}>
                            R$ {formatarValor(caixaAtual.totalSaidas || 0)}
                          </Text>
                        </View>
                        <View style={styles.caixaResumoItem}>
                          <Text style={styles.caixaResumoLabel}>Saldo Atual</Text>
                          <Text style={[styles.caixaResumoValor, { color: '#2196F3', fontSize: 18 }]}>
                            R$ {formatarValor(caixaAtual.saldoAtual || 0)}
                          </Text>
                        </View>
                      </View>
                      <Button
                        mode="contained"
                        icon="door-closed"
                        onPress={() => setFecharCaixaVisible(true)}
                        style={styles.caixaBtnFechar}
                      >
                        Fechar Caixa
                      </Button>
                    </Card.Content>
                  </Card>

                  <Text style={styles.secaoLabel}>Movimentações do Caixa</Text>
                  {(caixaAtual.transacoes || []).length === 0 ? (
                    <Text style={styles.subModuloVazio}>Nenhuma movimentação registrada.</Text>
                  ) : (
                    (caixaAtual.transacoes || []).map((t) => (
                      <View key={t.id} style={styles.caixaTransacaoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.caixaTransacaoCat}>{t.categoria}</Text>
                          {t.descricao ? (
                            <Text style={styles.caixaTransacaoDesc}>{t.descricao}</Text>
                          ) : null}
                          <Text style={styles.caixaTransacaoTime}>
                            {new Date(t.createdAt).toLocaleString('pt-BR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                            {t.userName ? ` — ${t.userName}` : ''}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.caixaTransacaoValor,
                            { color: t.tipo === 'ENTRADA' ? '#4caf50' : '#ff6b6b' },
                          ]}
                        >
                          {t.tipo === 'ENTRADA' ? '+' : '-'} R$ {formatarValor(t.valor || 0)}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              ) : (
                <Card style={styles.caixaCard}>
                  <Card.Content style={{ alignItems: 'center' }}>
                    <IconButton icon="door-closed" size={40} iconColor="#999" />
                    <Text style={styles.caixaFechadoTitulo}>Nenhum caixa aberto</Text>
                    {caixaAtual?.ultimoFechado ? (
                      <Text style={styles.caixaFechadoInfo}>
                        Último fechado em{' '}
                        {new Date(caixaAtual.ultimoFechado.fechadoEm).toLocaleString('pt-BR')}
                      </Text>
                    ) : null}
                    <Text style={styles.caixaFechadoInfo}>Horário de funcionamento: 17h às 06h</Text>
                    <Button
                      mode="contained"
                      icon="door-open"
                      onPress={() => setAbrirCaixaVisible(true)}
                      style={styles.caixaBtnAbrir}
                    >
                      Abrir Novo Caixa
                    </Button>
                  </Card.Content>
                </Card>
              )
            )}

            {/* ---- HISTÓRICO ---- */}
            {caixaSubTab === 'historico' && (
              caixaHistorico.length === 0 ? (
                <Text style={styles.subModuloVazio}>Nenhum registro de caixa encontrado.</Text>
              ) : (
                caixaHistorico.map((caixa) => (
                  <Card key={caixa.id} style={styles.caixaCard}>
                    <Card.Content>
                      <View style={styles.caixaStatusRow}>
                        <Chip
                          icon={caixa.status === 'ABERTO' ? 'door-open' : 'door-closed'}
                          style={caixa.status === 'ABERTO' ? styles.caixaBadgeAberto : styles.caixaBadgeFechado}
                          textStyle={{ color: '#fff', fontSize: 11 }}
                        >
                          {caixa.status}
                        </Chip>
                        <Text style={styles.caixaStatusTime}>
                          {new Date(caixa.abertoEm).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                          {caixa.fechadoEm
                            ? ` → ${new Date(caixa.fechadoEm).toLocaleString('pt-BR', {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                              })}`
                            : ''}
                        </Text>
                      </View>
                      <View style={styles.caixaHistResumo}>
                        <Text style={styles.caixaHistItem}>Inicial: R$ {formatarValor(caixa.saldoInicial || 0)}</Text>
                        <Text style={[styles.caixaHistItem, { color: '#4caf50' }]}>Entradas: R$ {formatarValor(caixa.totalEntradas || 0)}</Text>
                        <Text style={[styles.caixaHistItem, { color: '#ff6b6b' }]}>Saídas: R$ {formatarValor(caixa.totalSaidas || 0)}</Text>
                        <Text style={[styles.caixaHistItem, { color: '#2196F3' }]}>
                          Final: R$ {formatarValor(caixa.saldoFinal ?? ((caixa.saldoInicial || 0) + (caixa.totalEntradas || 0) - (caixa.totalSaidas || 0)))}
                        </Text>
                      </View>
                      {caixa.abertoPorNome ? (
                        <Text style={styles.caixaTransacaoTime}>Aberto por: {caixa.abertoPorNome}</Text>
                      ) : null}
                      {caixa.fechadoPorNome ? (
                        <Text style={styles.caixaTransacaoTime}>Fechado por: {caixa.fechadoPorNome}</Text>
                      ) : null}
                      {caixa.observacao ? (
                        <Text style={styles.caixaTransacaoDesc}>📝 {caixa.observacao}</Text>
                      ) : null}
                    </Card.Content>
                  </Card>
                ))
              )
            )}

            {/* ---- GASTOS BAR ---- */}
            {caixaSubTab === 'gastosbar' && (
              <>
                <View style={styles.tipoRow}>
                  <Chip
                    selected={gastosBarView === 'semanas'}
                    onPress={() => setGastosBarView('semanas')}
                    style={styles.chip}
                  >
                    Por Semana
                  </Chip>
                  <Chip
                    selected={gastosBarView === 'funcionarios'}
                    onPress={() => setGastosBarView('funcionarios')}
                    style={styles.chip}
                  >
                    Por Funcionário
                  </Chip>
                </View>
                <Text style={styles.gastosBarNota}>
                  Somente visualização. Lançamentos são gerados automaticamente por vendas em Vale
                  e por vales em dinheiro no PDV.
                </Text>
                {loadingGastosBar ? (
                  <ActivityIndicator color="#2196F3" style={{ marginTop: 16 }} />
                ) : gastosBarView === 'semanas' ? (
                  gastosBarSemanas.length === 0 ? (
                    <Text style={styles.subModuloVazio}>Nenhum gasto registrado.</Text>
                  ) : (
                    gastosBarSemanas.map((semana, idx) => (
                      <Card key={idx} style={styles.caixaCard}>
                        <Card.Content>
                          <Text style={styles.gastosBarSemanaTitulo}>
                            📅 Semana de {new Date(semana.semana + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </Text>
                          <View style={styles.gastosBarTags}>
                            {semana.totalProdutos > 0 && (
                              <Text style={styles.gastosBarTag}>🍺 R$ {formatarValor(semana.totalProdutos)}</Text>
                            )}
                            {semana.totalVales > 0 && (
                              <Text style={styles.gastosBarTag}>💵 R$ {formatarValor(semana.totalVales)}</Text>
                            )}
                            {semana.totalDescontos > 0 && (
                              <Text style={styles.gastosBarTag}>🏷️ R$ {formatarValor(semana.totalDescontos)}</Text>
                            )}
                            <Text style={[styles.gastosBarTag, { color: '#fff', fontWeight: 'bold' }]}>
                              Total: R$ {formatarValor(semana.total || 0)}
                            </Text>
                          </View>
                        </Card.Content>
                      </Card>
                    ))
                  )
                ) : gastosBarResumo.length === 0 ? (
                  <Text style={styles.subModuloVazio}>Nenhum gasto por funcionário.</Text>
                ) : (
                  gastosBarResumo.map((func, idx) => (
                    <Card key={idx} style={styles.caixaCard}>
                      <Card.Content>
                        <View style={styles.caixaStatusRow}>
                          <Text style={styles.gastosBarFuncNome}>👤 {func.funcionario}</Text>
                          <Text style={styles.caixaHistItem}>Total: R$ {formatarValor(func.total || 0)}</Text>
                        </View>
                        <View style={styles.gastosBarTags}>
                          <Text style={styles.gastosBarTag}>🍺 R$ {formatarValor(func.totalProdutos || 0)}</Text>
                          <Text style={styles.gastosBarTag}>💵 R$ {formatarValor(func.totalVales || 0)}</Text>
                          <Text style={styles.gastosBarTag}>🏷️ R$ {formatarValor(func.totalDescontos || 0)}</Text>
                        </View>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </>
            )}

            {/* ---- ORIGENS ---- */}
            {caixaSubTab === 'origens' && (
              <>
                <View style={styles.saldosRow}>
                  {['BAG', 'MÁQUINA', 'CAIXA'].map((nome) => {
                    const og = origemSaldos.find((o) => o.nome === nome);
                    const saldo = og?.saldo ?? og?.valor ?? 0;
                    return (
                      <View key={nome} style={styles.saldoChip}>
                        <Text style={styles.saldoNome}>{nome}</Text>
                        <Text
                          style={[
                            styles.saldoValor,
                            { color: saldo < 0 ? '#ff6b6b' : saldo === 0 ? '#999' : '#4caf50' },
                          ]}
                        >
                          R$ {formatarValor(saldo)}
                        </Text>
                        <Button
                          compact
                          mode="text"
                          textColor="#2196F3"
                          onPress={() => carregarOrigemHistorico(nome)}
                        >
                          {origemHistoricoNome === nome ? 'Fechar' : 'Histórico'}
                        </Button>
                      </View>
                    );
                  })}
                </View>

                {origemHistoricoNome && (
                  <Card style={styles.caixaCard}>
                    <Card.Content>
                      <Text style={styles.secaoLabel}>Histórico — {origemHistoricoNome}</Text>
                      {loadingOrigemHistorico ? (
                        <ActivityIndicator color="#2196F3" style={{ marginTop: 8 }} />
                      ) : origemHistoricoMovs.length === 0 ? (
                        <Text style={styles.subModuloVazio}>Nenhuma movimentação registrada.</Text>
                      ) : (
                        origemHistoricoMovs.map((m) => (
                          <View key={m.id} style={styles.caixaTransacaoRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.caixaTransacaoDesc}>{m.descricao || '—'}</Text>
                              <Text style={styles.caixaTransacaoTime}>
                                {new Date(m.createdAt).toLocaleString('pt-BR', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                })}
                                {'  · saldo: R$ '}
                                {formatarValor(m.saldoDepois || 0)}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.caixaTransacaoValor,
                                { color: m.tipo === 'ENTRADA' ? '#4caf50' : m.tipo === 'SAIDA' ? '#ff6b6b' : '#bbb' },
                              ]}
                            >
                              {m.tipo === 'ENTRADA' ? '+' : m.tipo === 'SAIDA' ? '-' : ''} R$ {formatarValor(m.valor || 0)}
                            </Text>
                          </View>
                        ))
                      )}
                    </Card.Content>
                  </Card>
                )}

                <Button
                  mode="outlined"
                  icon="refresh"
                  onPress={carregarOrigemSaldos}
                  style={{ marginTop: 8 }}
                >
                  Atualizar Saldos
                </Button>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* Modal de checkout */}
      <Portal>
        <Modal
          visible={checkoutVisible}
          onDismiss={() => setCheckoutVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              {comandaEmPagamento ? 'Pagar Comanda' : 'Finalizar Venda'}
            </Text>
            {comandaEmPagamento && (
              <Text style={styles.comandaBanner}>
                Comanda: {comandaEmPagamento.clienteNome || comandaEmPagamento.customerName || `#${comandaEmPagamento.id}`}
              </Text>
            )}

            <View style={styles.resumoLinha}>
              <Text style={styles.resumoTexto}>Subtotal:</Text>
              <Text style={styles.resumoTexto}>R$ {formatarValor(subtotal)}</Text>
            </View>

            <Text style={styles.secaoLabel}>Desconto</Text>
            <View style={styles.descontoRow}>
              <Chip
                selected={descontoTipo === 'VALOR'}
                onPress={() => setDescontoTipo('VALOR')}
                style={styles.chip}
              >
                R$
              </Chip>
              <Chip
                selected={descontoTipo === 'PERCENTUAL'}
                onPress={() => setDescontoTipo('PERCENTUAL')}
                style={styles.chip}
              >
                %
              </Chip>
              <TextInput
                mode="outlined"
                dense
                keyboardType="numeric"
                value={descontoValor}
                onChangeText={setDescontoValor}
                placeholder="0"
                style={styles.descontoInput}
              />
            </View>

            {desconto > 0 && (
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoTexto}>Desconto:</Text>
                <Text style={styles.resumoTexto}>- R$ {formatarValor(desconto)}</Text>
              </View>
            )}
            <View style={styles.resumoLinha}>
              <Text style={styles.totalModalLabel}>Total:</Text>
              <Text style={styles.totalModalValor}>R$ {formatarValor(totalFinal)}</Text>
            </View>

            <Divider style={styles.divider} />
            <Text style={styles.secaoLabel}>Forma de pagamento</Text>
            <View style={styles.formasContainer}>
              {formasPagamento
                .filter((forma) => !comandaEmPagamento || forma.valor !== 'pendente')
                .map((forma) => (
                <Chip
                  key={forma.id}
                  selected={formaSelecionada?.id === forma.id}
                  onPress={() => setFormaSelecionada(forma)}
                  style={styles.formaChip}
                  showSelectedCheck
                >
                  {forma.nome}
                </Chip>
              ))}
            </View>

            {/* Campos específicos */}
            {tipoSel === 'dinheiro' && (
              <View style={styles.campoEspecifico}>
                <TextInput
                  label="Valor recebido"
                  mode="outlined"
                  keyboardType="numeric"
                  value={valorRecebido}
                  onChangeText={setValorRecebido}
                />
                {parseFloat(valorRecebido) > 0 && (
                  <Text style={styles.trocoTexto}>
                    Troco: R$ {formatarValor(Math.max((parseFloat(valorRecebido) || 0) - valorCobrado, 0))}
                  </Text>
                )}
              </View>
            )}

            {tipoSel === 'vale' && (
              <View style={styles.campoEspecifico}>
                <TextInput
                  label="Senha do vale"
                  mode="outlined"
                  secureTextEntry
                  value={senhaVale}
                  onChangeText={setSenhaVale}
                />
                <Text style={styles.avisoVale}>
                  Produtos serão lançados em Gastos Bar do funcionário.
                </Text>
              </View>
            )}

            {tipoSel === 'fiado' && (
              <View style={styles.campoEspecifico}>
                <Button
                  mode="outlined"
                  onPress={carregarClientes}
                  style={{ marginBottom: 8 }}
                >
                  Carregar clientes
                </Button>
                <View style={styles.novoClienteRow}>
                  <TextInput
                    label="Novo cliente"
                    mode="outlined"
                    dense
                    value={novoClienteNome}
                    onChangeText={setNovoClienteNome}
                    style={styles.novoClienteInput}
                  />
                  <Button
                    mode="contained"
                    icon="account-plus"
                    onPress={cadastrarClienteInline}
                    loading={savingCliente}
                    disabled={savingCliente}
                    compact
                  >
                    Cadastrar
                  </Button>
                </View>
                <TextInput
                  label="Buscar cliente..."
                  mode="outlined"
                  dense
                  value={clienteBusca}
                  onChangeText={setClienteBusca}
                  left={<TextInput.Icon icon="magnify" />}
                  style={{ marginBottom: 8 }}
                />
                <ScrollView style={styles.clientesLista}>
                  <RadioButton.Group
                    onValueChange={(v) => setClienteFiadoId(Number(v))}
                    value={clienteFiadoId ? String(clienteFiadoId) : ''}
                  >
                    {clientes
                      .filter((c) =>
                        (c.name || '')
                          .toLowerCase()
                          .includes(clienteBusca.toLowerCase())
                      )
                      .map((c) => (
                      <RadioButton.Item
                        key={c.id}
                        label={c.name}
                        value={String(c.id)}
                        labelStyle={{ color: '#fff' }}
                      />
                    ))}
                    {clientes.filter((c) =>
                      (c.name || '').toLowerCase().includes(clienteBusca.toLowerCase())
                    ).length === 0 && (
                      <Text style={styles.subModuloVazio}>Nenhum cliente encontrado.</Text>
                    )}
                  </RadioButton.Group>
                </ScrollView>
              </View>
            )}

            {/* Venda conjunta: Compra + Saque (dinheiro em nota na máquina) */}
            {!comandaEmPagamento && (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.secaoLabel}>Saque na venda (opcional)</Text>
                <TextInput
                  label="Valor do saque (R$)"
                  mode="outlined"
                  keyboardType="numeric"
                  value={saqueVendaValor}
                  onChangeText={setSaqueVendaValor}
                  placeholder="0,00"
                />
                {(parseFloat(saqueVendaValor) || 0) > 0 && (
                  <View style={styles.saqueVendaBox}>
                    <View style={styles.resumoLinha}>
                      <Text style={styles.totalModalLabel}>Total Carrinho:</Text>
                      <Text style={styles.totalModalLabel}>R$ {formatarValor(totalFinal)}</Text>
                    </View>
                    <Divider style={styles.saqueVendaDivider} />
                    <View style={styles.resumoLinha}>
                      <Text style={styles.resumoTexto}>Cliente recebe:</Text>
                      <Text style={styles.resumoTexto}>
                        R$ {formatarValor(parseFloat(saqueVendaValor) || 0)}
                      </Text>
                    </View>
                    <View style={styles.resumoLinha}>
                      <Text style={styles.resumoTexto}>
                        Taxa ({taxaSaque}%):
                      </Text>
                      <Text style={styles.resumoTexto}>
                        + R$ {formatarValor((parseFloat(saqueVendaValor) || 0) * (taxaSaque / 100))}
                      </Text>
                    </View>
                    <View style={styles.resumoLinha}>
                      <Text style={styles.totalModalLabel}>Total Saque:</Text>
                      <Text style={styles.totalModalLabel}>
                        R$ {formatarValor((parseFloat(saqueVendaValor) || 0) * (1 + taxaSaque / 100))}
                      </Text>
                    </View>
                    <Divider style={styles.saqueVendaDivider} />
                    <View style={styles.resumoLinha}>
                      <Text style={styles.totalModalLabel}>Total à cobrar:</Text>
                      <Text style={styles.totalModalValor}>
                        R$ {formatarValor(
                          totalFinal +
                            (parseFloat(saqueVendaValor) || 0) * (1 + taxaSaque / 100)
                        )}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={styles.modalBotoes}>
              <Button
                mode="contained"
                onPress={finalizarComForma}
                loading={loading}
                disabled={loading}
                style={styles.confirmarButton}
                icon="check"
              >
                Confirmar
              </Button>
              <Button
                mode="outlined"
                onPress={() => setCheckoutVisible(false)}
                textColor="#fff"
              >
                Cancelar
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* Modal de composição (produtos dose / com componentes) */}
        <Modal
          visible={!!compModalProduct}
          onDismiss={() => setCompModalProduct(null)}
          contentContainerStyle={styles.modalContent}
        >
          {compModalProduct && (
            <ScrollView>
              <Text style={styles.modalTitle}>{compModalProduct.name}</Text>
              {(() => {
                const composicoes = compModalProduct.composicoes || [];
                // Divulgação progressiva: mostra até a primeira composição
                // ainda não completa. Para composição "múltipla", só é
                // considerada completa ao atingir o máximo de opções (maxOpcoes);
                // para simples, basta 1 opção selecionada.
                const compCompleta = (comp) => {
                  const qtd = (compSelections[comp.id] || []).length;
                  return comp.multiplo
                    ? qtd >= (comp.maxOpcoes || 1)
                    : qtd >= 1;
                };
                const firstEmptyIdx = composicoes.findIndex(
                  (comp) => !compCompleta(comp)
                );
                const visibleComps =
                  firstEmptyIdx === -1
                    ? composicoes
                    : composicoes.slice(0, firstEmptyIdx + 1);
                return visibleComps.map((comp) => (
                  <View key={comp.id} style={styles.compGroup}>
                    <View style={styles.compGroupHeader}>
                      <Text style={styles.compGroupNome}>
                        {comp.nome}
                        {comp.obrigatorio ? ' *' : ''}
                      </Text>
                      {comp.multiplo && (
                        <Text style={styles.compGroupMulti}>até {comp.maxOpcoes}</Text>
                      )}
                    </View>
                    {(comp.opcoes || [])
                      .filter((o) => o.disponivel)
                      .map((opcao) => {
                        const selected = (compSelections[comp.id] || []).includes(opcao.id);
                        const stockQty = opcao.estoque?.quantity ?? null;
                        const esgotado = stockQty != null && stockQty <= 0;
                        return (
                          <Chip
                            key={opcao.id}
                            selected={selected}
                            disabled={esgotado}
                            onPress={() =>
                              !esgotado &&
                              toggleCompOpcao(comp.id, opcao.id, comp.multiplo, comp.maxOpcoes)
                            }
                            style={styles.compOpcaoChip}
                            showSelectedCheck
                          >
                            {opcao.nome}
                            {opcao.valorExtra > 0
                              ? ` (+R$ ${formatarValor(opcao.valorExtra)})`
                              : ''}
                            {esgotado ? ' ✕' : ''}
                          </Chip>
                        );
                      })}
                  </View>
                ));
              })()}

              <Divider style={styles.divider} />
              <View style={styles.resumoLinha}>
                <Text style={styles.totalModalLabel}>Total:</Text>
                <Text style={styles.totalModalValor}>
                  R${' '}
                  {formatarValor(
                    (compModalProduct.value || 0) +
                      (compModalProduct.composicoes || []).reduce((sum, comp) => {
                        const sel = compSelections[comp.id] || [];
                        return (
                          sum +
                          (comp.opcoes || [])
                            .filter((o) => sel.includes(o.id))
                            .reduce((s, o) => s + (o.valorExtra || 0), 0)
                        );
                      }, 0)
                  )}
                </Text>
              </View>

              <View style={styles.modalBotoes}>
                <Button
                  mode="contained"
                  onPress={confirmComposicao}
                  style={styles.confirmarButton}
                  icon="cart-plus"
                >
                  Adicionar ao Carrinho
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setCompModalProduct(null)}
                  textColor="#fff"
                >
                  Cancelar
                </Button>
              </View>
            </ScrollView>
          )}
        </Modal>

        {/* Modal Pix */}
        <Modal
          visible={pixVisible}
          onDismiss={cancelarPix}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Pagamento Pix</Text>
          {pixData?.qrCodeBase64 ? (
            <Image
              source={{ uri: `data:image/png;base64,${pixData.qrCodeBase64}` }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <ActivityIndicator size="large" color="#2196F3" style={{ margin: 20 }} />
          )}
          {pixData?.qrCode && (
            <View style={styles.copiaCola}>
              <Text style={styles.copiaColaLabel}>Copia e cola:</Text>
              <Text style={styles.copiaColaTexto} selectable>
                {pixData.qrCode}
              </Text>
            </View>
          )}
          <View style={styles.pixStatusRow}>
            <ActivityIndicator size="small" color="#ffeb3b" />
            <Text style={styles.pixStatusTexto}>
              Aguardando pagamento... ({pixStatus})
            </Text>
          </View>
          <Button mode="outlined" onPress={cancelarPix} textColor="#fff" style={{ marginTop: 12 }}>
            Cancelar
          </Button>
        </Modal>

        {/* Modal Maquininha (Point) */}
        <Modal
          visible={pointVisible}
          onDismiss={cancelarPoint}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Pagamento na Máquina</Text>
          <ActivityIndicator size="large" color="#2196F3" style={{ margin: 20 }} />
          <Text style={styles.pointInfo}>
            {pointOrder?.paymentType === 'credit_card'
              ? 'Crédito'
              : pointOrder?.paymentType === 'debit_card'
              ? 'Débito'
              : 'Aguardando seleção no terminal'}
          </Text>
          <Text style={styles.pointValor}>
            R$ {formatarValor(pointOrder?.amount || calcularTotalFinal())}
          </Text>
          <View style={styles.pixStatusRow}>
            <ActivityIndicator size="small" color="#ffeb3b" />
            <Text style={styles.pixStatusTexto}>
              Aguardando pagamento... ({pointStatus})
            </Text>
          </View>
          <Button mode="outlined" onPress={cancelarPoint} textColor="#fff" style={{ marginTop: 12 }}>
            Cancelar
          </Button>
        </Modal>

        {/* Modal Abrir Caixa */}
        <Modal
          visible={abrirCaixaVisible}
          onDismiss={() => setAbrirCaixaVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Abrir Novo Caixa</Text>
          <Text style={styles.caixaFechadoInfo}>Horário de funcionamento: 17h às 06h</Text>
          <TextInput
            label="Saldo Inicial — CAIXA (R$)"
            mode="outlined"
            dense
            keyboardType="numeric"
            value={caixaSaldoInicial}
            onChangeText={setCaixaSaldoInicial}
            style={styles.saqueInput}
          />
          <View style={styles.tipoRow}>
            <TextInput
              label="Saldo BAG (R$)"
              mode="outlined"
              dense
              keyboardType="numeric"
              value={caixaOrigemBAG}
              onChangeText={setCaixaOrigemBAG}
              style={styles.flexInput}
            />
            <TextInput
              label="Saldo MÁQUINA (R$)"
              mode="outlined"
              dense
              keyboardType="numeric"
              value={caixaOrigemMAQUINA}
              onChangeText={setCaixaOrigemMAQUINA}
              style={styles.flexInput}
            />
          </View>
          <TextInput
            label="Observação (opcional)"
            mode="outlined"
            dense
            value={caixaObsAbrir}
            onChangeText={setCaixaObsAbrir}
            style={styles.saqueInput}
          />
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setAbrirCaixaVisible(false)} textColor="#fff">
              Cancelar
            </Button>
            <Button
              mode="contained"
              icon="door-open"
              onPress={abrirCaixa}
              loading={savingCaixa}
              disabled={savingCaixa}
            >
              Abrir Caixa
            </Button>
          </View>
        </Modal>

        {/* Modal Fechar Caixa */}
        <Modal
          visible={fecharCaixaVisible}
          onDismiss={() => setFecharCaixaVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Fechar Caixa</Text>
          <Text style={styles.caixaFechadoInfo}>
            Saldo atual: R$ {formatarValor(caixaAtual?.saldoAtual || 0)}
          </Text>
          <TextInput
            label="Observação de fechamento (opcional)"
            mode="outlined"
            dense
            value={caixaObsFechar}
            onChangeText={setCaixaObsFechar}
            style={styles.saqueInput}
          />
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setFecharCaixaVisible(false)} textColor="#fff">
              Cancelar
            </Button>
            <Button
              mode="contained"
              icon="door-closed"
              buttonColor="#e53935"
              onPress={fecharCaixa}
              loading={savingCaixa}
              disabled={savingCaixa}
            >
              Fechar Caixa
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
  },
  leftPanel: {
    flex: 2,
    marginRight: 8,
  },
  rightPanel: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#fff',
  },
  searchInput: {
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  produtosList: {
    flex: 1,
  },
  produtoCard: {
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  produtoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  produtoTexto: {
    flex: 1,
  },
  produtoNome: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  produtoUnidade: {
    fontSize: 12,
    color: '#999',
  },
  produtoPreco: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  unitOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  unitOptionChip: {
    backgroundColor: '#2a2a2a',
  },
  unitOptionChipActive: {
    backgroundColor: '#1565C0',
  },
  unitOptionChipOut: {
    opacity: 0.5,
  },
  unitOptionChipText: {
    color: '#fff',
    fontSize: 12,
  },
  carrinhoCard: {
    marginBottom: 8,
    maxHeight: '55%',
    backgroundColor: '#1a1a1a',
  },
  carrinhoVazio: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
  },
  carrinhoLista: {
    maxHeight: 260,
  },
  carrinhoItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  carrinhoItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  carrinhoItemNome: {
    fontSize: 13,
    color: '#fff',
    flex: 1,
  },
  carrinhoItemComp: {
    fontSize: 11,
    color: '#90caf9',
    fontStyle: 'italic',
    marginTop: 2,
  },
  carrinhoItemPreco: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  carrinhoItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantidade: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
    color: '#fff',
  },
  totalCard: {
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  totalLabel: {
    fontSize: 14,
    color: '#fff',
  },
  totalValor: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  finalizarButton: {
    paddingVertical: 8,
    backgroundColor: '#4caf50',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    margin: 16,
    borderRadius: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    color: '#2196F3',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  resumoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  resumoTexto: {
    color: '#ccc',
    fontSize: 14,
  },
  totalModalLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalModalValor: {
    color: '#4caf50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secaoLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  caixaSubTabBar: {
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 6,
    marginBottom: 8,
  },
  caixaContent: {
    flex: 1,
  },
  caixaCard: {
    backgroundColor: '#1a1a1a',
    marginBottom: 10,
  },
  caixaStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  caixaBadgeAberto: {
    backgroundColor: '#2e7d32',
  },
  caixaBadgeFechado: {
    backgroundColor: '#555',
  },
  caixaStatusTime: {
    color: '#bbb',
    fontSize: 12,
    flexShrink: 1,
  },
  caixaResumoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  caixaResumoItem: {
    width: '50%',
    paddingVertical: 6,
  },
  caixaResumoLabel: {
    color: '#999',
    fontSize: 12,
  },
  caixaResumoValor: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  caixaBtnFechar: {
    backgroundColor: '#e53935',
    marginTop: 10,
  },
  caixaBtnAbrir: {
    backgroundColor: '#4caf50',
    marginTop: 12,
  },
  caixaTransacaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  caixaTransacaoCat: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  caixaTransacaoDesc: {
    color: '#ccc',
    fontSize: 12,
  },
  caixaTransacaoTime: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  caixaTransacaoValor: {
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  caixaFechadoTitulo: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  caixaFechadoInfo: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  caixaHistResumo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 4,
  },
  caixaHistItem: {
    color: '#ddd',
    fontSize: 12,
  },
  gastosBarNota: {
    color: '#888',
    fontSize: 11,
    marginBottom: 8,
  },
  gastosBarSemanaTitulo: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  gastosBarTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gastosBarTag: {
    color: '#ddd',
    fontSize: 12,
  },
  gastosBarFuncNome: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  descontoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    marginRight: 6,
  },
  descontoInput: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: '#333',
  },
  divider: {
    backgroundColor: '#444',
    marginVertical: 10,
  },
  formasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  formaChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  campoEspecifico: {
    marginTop: 12,
  },
  trocoTexto: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  avisoVale: {
    color: '#ffeb3b',
    fontSize: 12,
    marginTop: 8,
  },
  clientesLista: {
    maxHeight: 200,
  },
  novoClienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  novoClienteInput: {
    flex: 1,
    marginRight: 8,
  },
  saqueVendaBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(33,150,243,0.12)',
  },
  saqueVendaDivider: {
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  compGroup: {
    marginBottom: 12,
  },
  compGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  compGroupNome: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  compGroupMulti: {
    fontSize: 12,
    color: '#90caf9',
  },
  compOpcaoChip: {
    marginBottom: 6,
  },
  modalBotoes: {
    marginTop: 16,
  },
  confirmarButton: {
    backgroundColor: '#4caf50',
    marginBottom: 8,
  },
  qrImage: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  copiaCola: {
    marginTop: 12,
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 4,
  },
  copiaColaLabel: {
    color: '#999',
    fontSize: 12,
  },
  copiaColaTexto: {
    color: '#fff',
    fontSize: 11,
  },
  pixStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  pixStatusTexto: {
    color: '#ffeb3b',
    marginLeft: 8,
  },
  subTabBar: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
  },
  subTabChip: {
    marginRight: 6,
    marginBottom: 4,
  },
  subModuloContainer: {
    flex: 1,
    padding: 12,
  },
  subModuloHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subModuloTitulo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subModuloVazio: {
    color: '#999',
    fontStyle: 'italic',
    marginTop: 16,
    textAlign: 'center',
  },
  comandaCard: {
    marginBottom: 10,
    backgroundColor: '#1a1a1a',
  },
  comandaCliente: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  comandaClienteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comandaClienteTotal: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: 'bold',
  },
  comandaSubCard: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  comandaSubTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comandaSubId: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 13,
  },
  comandaSubValor: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  comandaInfo: {
    color: '#bbb',
    marginTop: 2,
    marginBottom: 8,
  },
  comandaPagarBtn: {
    backgroundColor: '#4CAF50',
  },
  comandaBanner: {
    color: '#4CAF50',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  saqueCard: {
    backgroundColor: '#1a1a1a',
  },
  saqueInput: {
    marginBottom: 10,
    backgroundColor: '#1a1a1a',
  },
  saqueInfo: {
    color: '#bbb',
    marginBottom: 6,
  },
  saqueButton: {
    marginTop: 12,
    backgroundColor: '#FF9800',
  },
  pointInfo: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  pointValor: {
    color: '#4CAF50',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  subTabBarContent: {
    alignItems: 'center',
    paddingRight: 8,
  },
  origemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  origemPickerWrap: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 6,
    justifyContent: 'center',
  },
  origemPicker: {
    color: '#fff',
  },
  origemValorInput: {
    width: 100,
    backgroundColor: '#1a1a1a',
  },
  saldosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  saldoChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  saldoNome: {
    color: '#999',
    fontSize: 11,
  },
  saldoValor: {
    color: '#4caf50',
    fontSize: 15,
    fontWeight: 'bold',
  },
  somaOk: {
    color: '#4caf50',
  },
  somaErro: {
    color: '#ff9800',
  },
  stepIndicator: {
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  premioPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: '#000',
  },
  premioBotoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  premioConfirmImgs: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  premioThumb: {
    width: 90,
    height: 90,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#000',
  },
  configSubtabs: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dataFiltroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dataInput: {
    flex: 1,
    marginRight: 6,
    backgroundColor: '#1a1a1a',
  },
  pedidoItem: {
    color: '#bbb',
    fontSize: 13,
    marginTop: 2,
  },
  pedidoAcoes: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  tipoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  flexInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  smallInput: {
    width: 90,
    marginLeft: 6,
    backgroundColor: '#1a1a1a',
  },
  configItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 2,
  },
  configItemNome: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  formaConfigBlock: {
    marginBottom: 4,
  },
  formaPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  formaPointLabel: {
    color: '#ccc',
    fontSize: 13,
  },
  formaPointPickerWrap: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    marginTop: 4,
    marginLeft: 8,
  },
  formaPointPicker: {
    color: '#fff',
  },
  formaConfigDivider: {
    backgroundColor: '#333',
    marginTop: 6,
  },
  pointConfigTitulo: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 4,
  },
  pointTerminalAtual: {
    color: '#ccc',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  pointTerminalAtualId: {
    color: '#fff',
    fontWeight: 'bold',
  },
  pointTerminalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  pointTerminalRowSel: {
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  pointTerminalId: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  pointTerminalModo: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  pointTerminalAcoes: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pointParcelasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  pointParcelasInput: {
    width: 70,
    marginLeft: 8,
  },
  configItemSub: {
    color: '#999',
    fontSize: 12,
  },
  limiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
