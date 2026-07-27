import axios from "axios";
import "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import "./CashRegister.css";
import Message from "./Message";

const CashRegister = () => {
  const [card, setCard] = useState("");
  const [cash, setCash] = useState("");
  const [date, setDate] = useState(new Date().toISOString().substr(0, 10));
  const [balance, setBalance] = useState(null);
  const [balancefim, setBalancefim] = useState({});
  const [cartaofimcaixa, setCartaofimcaixa] = useState({});
  const [dinheirofimcaixa, setDinheirofimcaixa] = useState({});
  const [showMessage, setShowMessage] = useState(false);
  const [balances, setBalances] = useState([]);
  const [activeTab, setActiveTab] = useState("weekly");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState({ show: false, index: null });
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [valorMaquinaSemana, setValorMaquinaSemana] = useState({});

  useEffect(() => {
    // Buscar saldos da API quando o componente for montado
    axios
      .get("https://api-start-pira.vercel.app/api/balances")
      .then((response) => {
        setBalances(response.data);
        // Inicializar os estados dos inputs com os valores retornados
        const initialCartaofimcaixa = {};
        const initialDinheirofimcaixa = {};
        response.data.forEach((balance) => {
          initialCartaofimcaixa[balance.id] = balance.cartaofimcaixa || "";
          initialDinheirofimcaixa[balance.id] = balance.dinheirofimcaixa || "";
        });
        setCartaofimcaixa(initialCartaofimcaixa);
        setDinheirofimcaixa(initialDinheirofimcaixa);
      })
      .catch((error) => {
        console.error("Erro ao buscar saldos:", error);
      });
  }, []);

  useEffect(() => {
    // Carrega o valor salvo da semana ao alternar semana/mês
    const carregarValorMaquina = async () => {
      const weeklyBalances = calculateWeeklyBalances(selectedMonth);
      const weekInfo = weeklyBalances[selectedWeek];
      const weekStart = weekInfo?.start || weekInfo?.balances[0]?.date;
      if (!weekStart) return;

      const dateObj = new Date(weekStart);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const week = selectedWeek + 1;

      try {
        const res = await axios.get(`https://api-start-pira.vercel.app/api/machine-week-value?year=${year}&month=${month}&week=${week}`);
        const valor = res.data[0]?.value || 0;
        setValorMaquinaSemana((prev) => ({
          ...prev,
          [selectedWeek]: valor,
        }));
      } catch (err) {
        // Se não houver valor, zera o campo
        setValorMaquinaSemana((prev) => ({
          ...prev,
          [selectedWeek]: 0,
        }));
      }
    };

    carregarValorMaquina();
  }, [selectedWeek, selectedMonth]);

  // Carrega valores de máquina de TODAS as semanas do mês
  useEffect(() => {
    const carregarTodosValoresMaquina = async () => {
      const weeklyBalances = calculateWeeklyBalances(selectedMonth);
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;
      
      const novosValores = {};
      
      for (let i = 0; i < weeklyBalances.length; i++) {
        try {
          const res = await axios.get(`https://api-start-pira.vercel.app/api/machine-week-value?year=${year}&month=${month}&week=${i + 1}`);
          novosValores[i] = res.data[0]?.value || 0;
        } catch (err) {
          novosValores[i] = 0;
        }
      }
      
      setValorMaquinaSemana(novosValores);
    };

    carregarTodosValoresMaquina();
  }, [selectedMonth, balances]);

  const handleConfirm = () => {
    const cardValue = parseFloat(card) || 0;
    const cashValue = parseFloat(cash) || 0;
    const totalBalance = cardValue + cashValue;
    const formattedDate = format(parseISO(date), "yyyy-MM-dd"); // Formatar a data corretamente
    const newBalance = { date: formattedDate, balance: totalBalance, cartao: cardValue, dinheiro: cashValue };

    axios
      .post("https://api-start-pira.vercel.app/api/balances", newBalance)
      .then((response) => {
        setBalances([...balances, response.data]);
        setBalance(totalBalance);
        setShowMessage(true);
        setTimeout(() => {
          setShowMessage(false);
        }, 3000);
      })
      .catch((error) => {
        console.error("Erro ao adicionar saldo:", error);
      });
  };

  const handleUpdateBalance = (id) => {
    const cartaofimcaixaValue = parseFloat(cartaofimcaixa[id]) || 0;
    const dinheirofimcaixaValue = parseFloat(dinheirofimcaixa[id]) || 0;
    const balancefimValue = cartaofimcaixaValue + dinheirofimcaixaValue;
    const lucroValue = balancefimValue - (balances.find((balance) => balance.id === id)?.balance || 0);

    axios
      .put(`https://api-start-pira.vercel.app/api/balances/${id}`, {
        cartaofimcaixa: cartaofimcaixaValue,
        dinheirofimcaixa: dinheirofimcaixaValue,
        balancefim: balancefimValue,
        lucro: lucroValue,
      })
      .then((response) => {
        const updatedBalances = balances.map((balance) => (balance.id === id ? response.data : balance));
        setBalances(updatedBalances);
        setCartaofimcaixa((prev) => ({ ...prev, [id]: cartaofimcaixaValue }));
        setDinheirofimcaixa((prev) => ({ ...prev, [id]: dinheirofimcaixaValue }));
        setShowMessage(true);

        setTimeout(() => {
          setShowMessage(false);
        }, 3000);
      })
      .catch((error) => {
        console.error("Erro ao atualizar saldo:", error);
      });
  };

  const handleDeleteBalance = (id) => {
    setConfirmDelete({ show: true, id });
  };

  const confirmDeleteBalance = () => {
    const { id } = confirmDelete;
    axios
      .delete(`https://api-start-pira.vercel.app/api/balances/${id}`)
      .then(() => {
        const updatedBalances = balances.filter((balance) => balance.id !== id);
        setBalances(updatedBalances);
        setConfirmDelete({ show: false, id: null });
      })
      .catch((error) => {
        console.error("Erro ao excluir saldo:", error);
      });
  };

  const cancelDeleteBalance = () => {
    setConfirmDelete({ show: false, id: null });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // const handleCurrencyChange = (setter) => (e) => {
  //   const value = e.target.value;
  //   const formattedValue = value
  //     .replace(/\D/g, "")
  //     .replace(/(\d)(\d{2})$/, "$1,$2")
  //     .replace(/(?=(\d{3})+(\D))\B/g, ".");
  //   setter(formattedValue);
  // };

  const calculateWeeklyBalances = (month) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const weeks = [];

    // Primeira semana: do dia 1 até o primeiro domingo OU fim do mês
    let firstWeekEnd = new Date(start);
    while (firstWeekEnd.getDay() !== 0 && firstWeekEnd < end) {
      // 0 = domingo
      firstWeekEnd.setDate(firstWeekEnd.getDate() + 1);
    }
    if (firstWeekEnd > end) firstWeekEnd = new Date(end);

    weeks.push({ start: new Date(start), end: new Date(firstWeekEnd) });

    // Próximas semanas: sempre de terça a domingo
    let nextStart = new Date(firstWeekEnd);
    nextStart.setDate(nextStart.getDate() + 1);

    while (nextStart <= end) {
      let weekStart = new Date(nextStart);
      // Garante que o início é terça-feira
      while (weekStart.getDay() !== 2 && weekStart <= end) {
        // 2 = terça-feira
        weekStart.setDate(weekStart.getDate() + 1);
      }
      if (weekStart > end) break;

      let weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + ((0 - weekStart.getDay() + 7) % 7)); // até domingo
      if (weekEnd > end) weekEnd = new Date(end);

      weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
      nextStart = new Date(weekEnd);
      nextStart.setDate(nextStart.getDate() + 1);
    }

    return weeks.map((range, index) => {
      // Filtra e ordena os saldos da semana por data
      const weeklyBalances = balances
        .filter((balance) => {
          const balanceDate = parseISO(balance.date);
          return balanceDate >= range.start && balanceDate <= range.end && balanceDate.getMonth() === month.getMonth();
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // <-- Ordena por data

      return {
        week: `Semana ${index + 1} (${format(range.start, "dd/MM", { locale: ptBR })} - ${format(range.end, "dd/MM", { locale: ptBR })})`,
        balances: weeklyBalances,
        start: range.start,
        end: range.end,
      };
    });
  };

  const calculateMonthlyBalances = (month) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const weeks = [];

    // Primeira semana: do dia 1 até o próximo domingo ou fim do mês
    let firstWeekEnd = new Date(start);
    while (firstWeekEnd.getDay() !== 0 && firstWeekEnd < end) {
      firstWeekEnd.setDate(firstWeekEnd.getDate() + 1);
    }
    if (firstWeekEnd > end) firstWeekEnd = new Date(end);

    weeks.push({ start: new Date(start), end: new Date(firstWeekEnd) });

    // Próximas semanas: sempre de terça a domingo
    let nextStart = new Date(firstWeekEnd);
    nextStart.setDate(nextStart.getDate() + 1);

    while (nextStart <= end) {
      let weekStart = new Date(nextStart);
      // Garante que o início é terça-feira
      while (weekStart.getDay() !== 2 && weekStart <= end) {
        weekStart.setDate(weekStart.getDate() + 1);
      }
      if (weekStart > end) break;

      let weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + ((0 - weekEnd.getDay() + 7) % 7)); // até domingo
      if (weekEnd > end) weekEnd = new Date(end);

      weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
      nextStart = new Date(weekEnd);
      nextStart.setDate(nextStart.getDate() + 1);
    }

    return weeks.map((range, index) => {
      const weeklyBalances = balances.filter((balance) => {
        const balanceDate = parseISO(balance.date);
        return balanceDate >= range.start && balanceDate <= range.end && balanceDate.getMonth() === month.getMonth() && balanceDate.getFullYear() === month.getFullYear();
      });

      const totalBalance = weeklyBalances.reduce((acc, balance) => acc + (balance.balance || 0), 0);
      const totalLucro = weeklyBalances.reduce((acc, balance) => acc + (balance.lucro || 0), 0);
      const totalBalancefim = weeklyBalances.reduce((acc, balance) => acc + (balance.balancefim || 0), 0);

      return {
        week: `Semana ${index + 1} (${format(range.start, "dd/MM", { locale: ptBR })} - ${format(range.end, "dd/MM", { locale: ptBR })})`,
        totalBalance,
        totalLucro,
        totalBalancefim,
      };
    });
  };

  const weeklyBalances = calculateWeeklyBalances(selectedMonth);
  const monthlyBalances = calculateMonthlyBalances(selectedMonth);

  const semanaData = {
    labels: weeklyBalances[selectedWeek].balances.map((balance) => {
      const localDate = parseISO(balance.date);
      return format(localDate, "eee - dd/MM", { locale: ptBR });
    }),
    datasets: [
      {
        label: "Saldo Inicial",
        data: weeklyBalances[selectedWeek].balances.map((balance) => balance.balance || 0),
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
      {
        label: "Lucro",
        data: weeklyBalances[selectedWeek].balances.map((balance, idx, arr) => (balance.lucro || 0) + (idx === 0 ? valorMaquinaSemana[selectedWeek] || 0 : 0)),
        backgroundColor: "rgba(255, 206, 86, 0.2)",
        borderColor: "rgba(255, 206, 86, 1)",
        borderWidth: 1,
      },
      {
        label: "Saldo Final",
        data: weeklyBalances[selectedWeek].balances.map((balance) => balance.balancefim || 0),
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 1,
      },
    ],
  };

  const mesData = {
    labels: monthlyBalances.map((balance) => balance.week),
    datasets: [
      {
        label: "Saldo Inicial Semanal",
        data: monthlyBalances.map((balance) => balance.totalBalance),
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
      {
        label: "Lucro Semanal",
        data: monthlyBalances.map((balance) => balance.totalLucro),
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
      {
        label: "Valor Máquina Semanal",
        data: monthlyBalances.map((balance, index) => valorMaquinaSemana[index] || 0),
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        borderColor: "rgba(255, 159, 64, 1)",
        borderWidth: 1,
      },
      {
        label: "Saldo Final Semanal",
        data: monthlyBalances.map((balance) => balance.totalBalancefim),
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: {
        labels: {
          color: "white",
        },
      },
      datalabels: {
        color: "white",
        anchor: "center",
        align: "center",
        formatter: (value) => formatCurrency(value),
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: "white",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.2)",
        },
      },
      y: {
        stacked: true,
        ticks: {
          color: "white",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.2)",
        },
      },
    },
  };

  const handleMonthChange = (direction) => {
    setSelectedMonth((prevMonth) => (direction === "prev" ? subMonths(prevMonth, 1) : addMonths(prevMonth, 1)));
  };

  // Calcular o lucro total da semana atual
  const totalLucroSemana = weeklyBalances[selectedWeek].balances.reduce((acc, balance) => acc + (balance.lucro || 0), 0);

  const totalLucroMes = monthlyBalances.reduce((acc, balance) => acc + balance.totalLucro, 0);

  // Filtrar registros do mês selecionado
  const monthBalances = [...balances]
    .filter((balance) => {
      const balanceDate = parseISO(balance.date);
      return balanceDate >= startOfMonth(selectedMonth) && balanceDate <= endOfMonth(selectedMonth);
    });

  // Agrupar registros por semana com ordem crescente
  const groupedByWeek = weeklyBalances.map((weekInfo, weekIndex) => {
    const weekBalances = monthBalances
      .filter((balance) => {
        const balanceDate = parseISO(balance.date);
        return balanceDate >= weekInfo.start && balanceDate <= weekInfo.end;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Ordem crescente (menor para maior)
    
    return {
      weekLabel: weekInfo.week,
      balances: weekBalances
    };
  }).filter(group => group.balances.length > 0); // Remove semanas sem registros

  // Calcular o valor total da máquina na semana selecionada
  const totalValorMaquinaSemana = valorMaquinaSemana[selectedWeek] || 0;

  // Calcular o valor total da máquina no mês (soma de todos os valores das semanas do mês)
  const totalValorMaquinaMes = Object.values(valorMaquinaSemana).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);

  return (
    <div className="cash-register-container">
      <h2>Registro de Caixa</h2>
      <div className="input-cash">
        <label className="desc-text">Cartão</label>
        <input type="number" value={card} onChange={(e) => setCard(e.target.value)} placeholder="Valor em cartão" />
      </div>
      <div className="input-cash">
        <label className="desc-text">Dinheiro</label>
        <input type="number" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="Valor em dinheiro" />
      </div>
      <div className="input-cash">
        <label className="desc-text">Data</label>
      </div>
      <div className="date-selector">
        <button onClick={() => {
          const newDate = new Date(date);
          newDate.setMonth(newDate.getMonth() - 1);
          setDate(newDate.toISOString().split("T")[0]);
        }}>&lt;&lt; Mês</button>
        <button onClick={() => {
          const newDate = new Date(date);
          newDate.setDate(newDate.getDate() - 1);
          setDate(newDate.toISOString().split("T")[0]);
        }}>&lt; Dia</button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={() => {
          const newDate = new Date(date);
          newDate.setDate(newDate.getDate() + 1);
          setDate(newDate.toISOString().split("T")[0]);
        }}>&gt; Dia</button>
        <button onClick={() => {
          const newDate = new Date(date);
          newDate.setMonth(newDate.getMonth() + 1);
          setDate(newDate.toISOString().split("T")[0]);
        }}>&gt;&gt; Mês</button>
      </div>
      <button onClick={handleConfirm} className="confirm-button">
        Confirmar
      </button>
      {showMessage && <Message message="Saldo de caixa atualizado com sucesso!" type="success" onClose={() => setShowMessage(false)} />}
      {confirmDelete.show && <Message message="Tem certeza que deseja excluir este saldo?" type="warning" onClose={cancelDeleteBalance} onConfirm={confirmDeleteBalance} />}
      <div className="tabs">
        <button onClick={() => setActiveTab("weekly")} className={activeTab === "weekly" ? "active" : ""}>
          Saldo Semanal
        </button>
        <button onClick={() => setActiveTab("monthly")} className={activeTab === "monthly" ? "active" : ""}>
          Saldo Mensal
        </button>
      </div>
      <div className="month-selector">
        <button className="but-mes" onClick={() => handleMonthChange("prev")}>
          Mês Anterior
        </button>
        <span>{format(selectedMonth, "MMMM yyyy", { locale: ptBR })}</span>
        <button className="but-prox-mes" onClick={() => handleMonthChange("next")}>
          Próximo Mês
        </button>
      </div>
      {activeTab === "weekly" && (
        <div className="tab-content">
          <h3 className="titulo-semanal">Saldo Semanal</h3>
          <div className="week-selector">
            {weeklyBalances.map((week, index) => (
              <button
                key={index}
                onClick={() => setSelectedWeek(index)}
                className={selectedWeek === index ? "active" : ""}
              >
                {week.week}
              </button>
            ))}
          </div>

          {/* Lista de registros da semana selecionada */}
          {weeklyBalances[selectedWeek]?.balances.length > 0 && (
            <div className="balance-list">
              <h3 className="saldo">Registros da Semana</h3>
              <ul>
                {weeklyBalances[selectedWeek].balances.map((entry) => (
                  <li className="registro" key={entry.id}>
                    <span className="balance-value">
                      {format(parseISO(entry.date), "eee - dd/MM", { locale: ptBR })}: 
                      <span className="balance-amount">{formatCurrency(entry.balance)}</span>
                    </span>
                    
                    <div className="input-container-cx">
                      <label className="desc-text-label">Valor Final Dinheiro</label>
                      <input
                        className="final-caixa"
                        type="text"
                        value={dinheirofimcaixa[entry.id] || ""}
                        onChange={(e) => setDinheirofimcaixa({ ...dinheirofimcaixa, [entry.id]: e.target.value })}
                        placeholder="Final caixa dinheiro"
                      />
                    </div>
                    
                    <div className="input-container-cx">
                      <label className="desc-text-label">Valor Final Cartão</label>
                      <input
                        className="final-caixa"
                        type="text"
                        value={cartaofimcaixa[entry.id] || ""}
                        onChange={(e) => setCartaofimcaixa({ ...cartaofimcaixa, [entry.id]: e.target.value })}
                        placeholder="Final caixa cartão"
                      />
                    </div>

                    <div className="button-group-cx">
                      <button onClick={() => handleUpdateBalance(entry.id)} className="update-button-cx">
                        Atualizar
                      </button>
                      <button onClick={() => handleDeleteBalance(entry.id)} className="delete-button-cx">
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Campos da máquina e gráfico abaixo dos registros */}
          <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <label style={{ color: "#fff", marginRight: 8 }}>Valor Máquina Semana:</label>
            <input
              type="number"
              value={valorMaquinaSemana[selectedWeek] || ""}
              onChange={(e) =>
                setValorMaquinaSemana((prev) => ({
                  ...prev,
                  [selectedWeek]: parseFloat(e.target.value) || 0,
                }))
              }
              style={{ width: 120, padding: 4 }}
              placeholder="R$"
            />
            <button
              style={{ background: "#0078d4", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}
              onClick={async () => {
                const weekInfo = weeklyBalances[selectedWeek];
                const weekStart = weekInfo.balances[0]?.date;
                if (!weekStart) return alert("Semana inválida");
                const dateObj = new Date(weekStart);
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth() + 1;
                const week = selectedWeek + 1;
                const value = valorMaquinaSemana[selectedWeek] || 0;
                try {
                  await axios.post("https://api-start-pira.vercel.app/api/machine-week-value", { year, month, week, value });
                  setShowMessage(true);
                  setTimeout(() => {
                    setShowMessage(false);
                  }, 3000);
                } catch (err) {
                  alert("Erro ao salvar valor!");
                }
              }}
            >
              Salvar
            </button>
          </div>
          <div style={{ margin: "8px 0", color: "#fff", textAlign: "center" }}>
            <strong>Valor Total Máquina Semana:</strong> {formatCurrency(totalValorMaquinaSemana)}
          </div>
          <div className="chart-container">
            <Bar data={semanaData} options={chartOptions} plugins={[ChartDataLabels]} />
            <span className="total-lucro-semana">Lucro Total da Semana: {formatCurrency(totalLucroSemana + totalValorMaquinaSemana)}</span>
          </div>
        </div>
      )}
      {activeTab === "monthly" && (
        <div className="tab-content">
          <h3>Saldo Mensal</h3>
          
          {/* Lista de todos os registros do mês agrupados por semana */}
          {weeklyBalances.map((weekInfo, weekIndex) => (
            <div key={weekIndex}>
              <strong style={{ display: "block", margin: "20px 0 10px", color: "#fff", fontSize: "1.1em", textAlign: "center" }}>
                {weekInfo.week}
              </strong>
              {weekInfo.balances.length > 0 ? (
                <ul className="balance-list-mensal">
                  {weekInfo.balances.map((entry) => (
                    <li className="registro" key={entry.id}>
                      <span className="balance-value">
                        {format(parseISO(entry.date), "eee - dd/MM", { locale: ptBR })}: 
                        <span className="balance-amount">{formatCurrency(entry.balance)}</span>
                      </span>
                      
                      <div className="input-container-cx">
                        <label className="desc-text-label">Valor Final Dinheiro</label>
                        <input
                          className="final-caixa"
                          type="text"
                          value={dinheirofimcaixa[entry.id] || ""}
                          onChange={(e) => setDinheirofimcaixa({ ...dinheirofimcaixa, [entry.id]: e.target.value })}
                          placeholder="Final caixa dinheiro"
                        />
                      </div>
                      
                      <div className="input-container-cx">
                        <label className="desc-text-label">Valor Final Cartão</label>
                        <input
                          className="final-caixa"
                          type="text"
                          value={cartaofimcaixa[entry.id] || ""}
                          onChange={(e) => setCartaofimcaixa({ ...cartaofimcaixa, [entry.id]: e.target.value })}
                          placeholder="Final caixa cartão"
                        />
                      </div>

                      <div className="button-group-cx">
                        <button onClick={() => handleUpdateBalance(entry.id)} className="update-button-cx">
                          Atualizar
                        </button>
                        <button onClick={() => handleDeleteBalance(entry.id)} className="delete-button-cx">
                          Excluir
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "#fff", textAlign: "center" }}>Nenhum registro nesta semana</p>
              )}
            </div>
          ))}
          
          <div style={{ margin: "8px 0", color: "#fff", textAlign: "center" }}>
            <strong>Valor Total Máquina Mês:</strong> {formatCurrency(totalValorMaquinaMes)}
          </div>
          <div className="grafico-mes">
            <Bar data={mesData} options={chartOptions} plugins={[ChartDataLabels]} />
            <span className="total-lucro-semana">Lucro Total do Mês: {formatCurrency(totalLucroMes + totalValorMaquinaMes)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashRegister;
