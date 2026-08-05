import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
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
} from 'react-native-paper';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Formas de pagamento padrão (usadas se a API não retornar nenhuma)
const FORMAS_PADRAO = [
  { id: 'f-din', nome: 'Dinheiro', valor: 'dinheiro' },
  { id: 'f-cart', nome: 'Cartão', valor: 'cartao' },
  { id: 'f-pix', nome: 'Pix', valor: 'pix_online', pointType: 'pix_online' },
  { id: 'f-vale', nome: 'Vale', valor: 'vale' },
  { id: 'f-fiado', nome: 'Fiado', valor: 'pendente' },
];


export default function PDVScreen({ navigation }) {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
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

  const adicionarAoCarrinho = (produto) => {
    const itemExistente = carrinho.find((item) => item.id === produto.id);
    if (itemExistente) {
      setCarrinho(
        carrinho.map((item) =>
          item.id === produto.id
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
        },
      ]);
    }
  };

  const removerDoCarrinho = (produtoId) => {
    const item = carrinho.find((i) => i.id === produtoId);
    if (item.quantidade > 1) {
      setCarrinho(
        carrinho.map((i) =>
          i.id === produtoId ? { ...i, quantidade: i.quantidade - 1 } : i
        )
      );
    } else {
      setCarrinho(carrinho.filter((i) => i.id !== produtoId));
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
    setDescontoTipo('VALOR');
    setDescontoValor('');
    setCheckoutVisible(true);
  };

  const montarBodyVenda = ({ paymentLabel, amountReceived, change, valePassword, pendenteClientId }) => {
    const subtotal = calcularSubtotal();
    const descontoAmount = calcularDesconto(subtotal);
    const finalTotal = subtotal - descontoAmount;
    const cliente = clientes.find((c) => c.id === pendenteClientId);

    return {
      items: carrinho.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.value,
        quantity: i.quantidade,
        unit: i.unit,
        maxQuantity: i.maxQuantity,
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
      saque: null,
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
  const iniciarPagamentoComanda = (comanda) => {
    const itens = (comanda.items || []).map((item) => ({
      id: item.estoqueId || item.id,
      name: item.productName || item.name,
      value: item.unitPrice ?? item.price ?? 0,
      unit: item.unit || 'un',
      maxQuantity: item.quantity,
      quantidade: item.quantity,
      fromComanda: true,
    }));
    setCarrinho(itens);
    setComandaEmPagamento(comanda);
    setFormaSelecionada(null);
    setValorRecebido('');
    setSenhaVale('');
    setClienteFiadoId(null);
    setDescontoTipo('VALOR');
    setDescontoValor('');
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

    // Validações específicas
    if (tipo === 'dinheiro') {
      const recebido = parseFloat(valorRecebido) || 0;
      if (recebido < finalTotal) {
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
      await iniciarPix(finalTotal, label);
      return;
    }
    if (tipo === 'point') {
      await iniciarPagamentoPoint(formaSelecionada, finalTotal, label);
      return;
    }

    // Fluxo direto (dinheiro / vale / fiado / outros)
    setLoading(true);
    try {
      if (comandaEmPagamento) {
        await fecharComanda(label);
      } else {
        const recebido = parseFloat(valorRecebido) || finalTotal;
        const body = montarBodyVenda({
          paymentLabel: label,
          amountReceived: tipo === 'dinheiro' ? recebido : finalTotal,
          change: tipo === 'dinheiro' ? recebido - finalTotal : 0,
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

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="PDV - Ponto de Venda" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      {/* Abas de sub-módulos (ações) */}
      <View style={styles.subTabBar}>
        <Chip
          selected={subTab === 'venda'}
          onPress={() => setSubTab('venda')}
          style={styles.subTabChip}
          icon="cart"
        >
          Venda
        </Chip>
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
        {isAdmin && (
          <Chip
            onPress={() => navigation.navigate('CashRegister')}
            style={styles.subTabChip}
            icon="cash-register"
          >
            Caixa
          </Chip>
        )}
      </View>

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
            {produtosFiltrados.map((produto) => (
              <Card key={produto.id} style={styles.produtoCard}>
                <Card.Content>
                  <View style={styles.produtoInfo}>
                    <View style={styles.produtoTexto}>
                      <Text style={styles.produtoNome}>{produto.name}</Text>
                      <Text style={styles.produtoUnidade}>
                        {produto.unit} · estoque: {produto.quantity}
                      </Text>
                      <Text style={styles.produtoPreco}>
                        R$ {Number(produto.value || 0).toFixed(2)}
                      </Text>
                    </View>
                    <IconButton
                      icon="plus"
                      mode="contained"
                      onPress={() => adicionarAoCarrinho(produto)}
                    />
                  </View>
                </Card.Content>
              </Card>
            ))}
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
                    <View key={item.id} style={styles.carrinhoItem}>
                      <View style={styles.carrinhoItemInfo}>
                        <Text style={styles.carrinhoItemNome}>
                          {item.name} ({item.unit})
                        </Text>
                        <Text style={styles.carrinhoItemPreco}>
                          R$ {(item.value * item.quantidade).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.carrinhoItemControls}>
                        <IconButton
                          icon="minus"
                          size={20}
                          onPress={() => removerDoCarrinho(item.id)}
                        />
                        <Text style={styles.quantidade}>{item.quantidade}</Text>
                        <IconButton
                          icon="plus"
                          size={20}
                          onPress={() => adicionarAoCarrinho(item)}
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
              <Text style={styles.totalValor}>R$ {subtotal.toFixed(2)}</Text>
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
            comandas.map((comanda) => {
              const totalComanda = (comanda.items || []).reduce(
                (t, i) => t + (i.unitPrice ?? i.price ?? 0) * (i.quantity || 0),
                0
              );
              return (
                <Card key={comanda.id} style={styles.comandaCard}>
                  <Card.Content>
                    <Text style={styles.comandaCliente}>
                      {comanda.clienteNome || comanda.customerName || `Comanda #${comanda.id}`}
                    </Text>
                    <Text style={styles.comandaInfo}>
                      {(comanda.items || []).length} item(ns) · Total: R$ {totalComanda.toFixed(2)}
                    </Text>
                    <Button
                      mode="contained"
                      icon="cash"
                      onPress={() => iniciarPagamentoComanda(comanda)}
                      style={styles.comandaPagarBtn}
                    >
                      Pagar comanda
                    </Button>
                  </Card.Content>
                </Card>
              );
            })
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
                  Cobrar na máquina: R$ {saqueCobrarMaquina.toFixed(2)} (taxa R$ {saqueTaxaValor.toFixed(2)})
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
              <Text style={styles.resumoTexto}>R$ {subtotal.toFixed(2)}</Text>
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
                <Text style={styles.resumoTexto}>- R$ {desconto.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.resumoLinha}>
              <Text style={styles.totalModalLabel}>Total:</Text>
              <Text style={styles.totalModalValor}>R$ {totalFinal.toFixed(2)}</Text>
            </View>

            <Divider style={styles.divider} />
            <Text style={styles.secaoLabel}>Forma de pagamento</Text>
            <View style={styles.formasContainer}>
              {formasPagamento.map((forma) => (
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
                    Troco: R$ {Math.max((parseFloat(valorRecebido) || 0) - totalFinal, 0).toFixed(2)}
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
                <ScrollView style={styles.clientesLista}>
                  <RadioButton.Group
                    onValueChange={(v) => setClienteFiadoId(Number(v))}
                    value={clienteFiadoId ? String(clienteFiadoId) : ''}
                  >
                    {clientes.map((c) => (
                      <RadioButton.Item
                        key={c.id}
                        label={c.name}
                        value={String(c.id)}
                        labelStyle={{ color: '#fff' }}
                      />
                    ))}
                  </RadioButton.Group>
                </ScrollView>
              </View>
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
            R$ {Number(pointOrder?.amount || calcularTotalFinal()).toFixed(2)}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
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
});
